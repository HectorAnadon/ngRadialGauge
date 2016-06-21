/* global d3 */
/*
 ng-radial-gauge 1.0.2
 (c) 2010-2014 Stéphane Therrien,
 https://github.com/stherrienaspnet/ngRadialGauge
 License: MIT

 Version 1.0.2
 Author: Colin Bester
 Modified to add viewBox and use width attribute for scaling of SVG
 Removed flicker issue when using data=option mode.
*/
"use strict";
angular.module("ngRadialGauge", [])
  .directive('ngRadialGauge', ['$window', '$timeout',
    function($window, $timeout) {
      return {
        restrict: 'EAC',
        scope: {
          data: '=',
          lowerLimit: '=',
          upperLimit: '=',
          ranges: '=',
          value: '=',
          valueUnit: '=',
          precision: '=',
          majorGraduationPrecision: '=',
          label: '@',
          onClick: '&',
          showTip: '=?',
          onReady: '=?'
        },
        link: function(scope, ele, attrs) {
          var defaultUpperLimit = 100;
          var defaultLowerLimit = 0;
          var initialized = false;

          var renderTimeout;
          var gaugeAngle = parseInt(attrs.angle) || 120;

          //New width variable, now works in conjunction with fixed viewBox sizing
          var _width = attrs.width || "100%";

          if (scope.showTip) {
            var tip = d3.tip()
              .direction('e') // s or e
              .style('pointer-events', 'none')
              .attr('class', 'd3-tip');
          }

          /* Colin Bester
             Width and height are not really such an issue with SVG but choose these values as
             width of 300 seems to be pretty baked into code.
             I took the easy path seeing as size is not that relevant and hard coded width and height
             as I was too lazy to dig deep into code.
             May be the wrong call, but seems safe option.
          */
          var view = {
            width: 300,
            height: 225
          };
          var innerRadius = Math.round((view.width * 130) / 300);
          var outerRadius = Math.round((view.width * 145) / 300);
          var majorGraduations = parseInt(attrs.majorGraduations - 1) || 5;
          var minorGraduations = parseInt(attrs.minorGraduations) || 10;
          var majorGraduationLength = Math.round((view.width * 16) / 300);
          var minorGraduationLength = Math.round((view.width * 10) / 300);
          var majorGraduationMarginTop = Math.round((view.width * 7) / 300);
          var majorGraduationColor = attrs.majorGraduationColor ||
            "#B0B0B0";
          var minorGraduationColor = attrs.minorGraduationColor ||
            "#D0D0D0";
          var majorGraduationTextColor = attrs.majorGraduationTextColor ||
            "#6C6C6C";
          var needleColor = attrs.needleColor || "#416094";
          var valueVerticalOffset = Math.round((view.width * 30) / 300);
          var inactiveColor = "#D7D7D7";
          var transitionMs = parseInt(attrs.transitionMs) || 750;
          var majorGraduationTextSize = parseInt(attrs.majorGraduationTextSize);
          var needleValueTextSize = parseInt(attrs.needleValueTextSize);
          var needle = undefined;

          //The scope.data object might contain the data we need, otherwise we fall back on the scope.xyz property
          var extractData = function(prop) {
            if (!scope.data) return scope[prop];
            if (scope.data[prop] === undefined || scope.data[prop] ==
              null) {
              return scope[prop];
            }
            return scope.data[prop];
          };

          var maxLimit;
          var minLimit;
          var value;
          var valueUnit;
          var precision;
          var majorGraduationPrecision;
          var ranges;

          var updateInternalData = function() {
            maxLimit = extractData('upperLimit') ? extractData(
              'upperLimit') : defaultUpperLimit;
            minLimit = extractData('lowerLimit') ? extractData(
              'lowerLimit') : defaultLowerLimit;
            value = extractData('value');
            valueUnit = extractData('valueUnit');
            precision = extractData('precision');
            majorGraduationPrecision = extractData(
              'majorGraduationPrecision');
            ranges = extractData('ranges');
          };
          updateInternalData();

          var getTotalColor = function(value) {
            var i;

            for (i = 0; i < ranges.length; i++) {
              if (value >= ranges[i].min && value < ranges[i].max) {
                return ranges[i].color;
              }
            }
          };

          /* Colin Bester
             Add viewBox and width attributes.
             Used view.width and view.height in case it's decided that hardcoding these values is an issue.
             Width can be specified as %, px etc and will scale image to fit.
          */
          var svg = d3.select(ele[0])
            .append('svg')
            .attr('width', _width)
            .attr('viewBox', '0 0 ' + view.width + ' ' + view.height);
          // .attr('view.width', view.width)
          // .attr('height', view.width * 0.75);
          var renderMajorGraduations = function(majorGraduationsAngles) {
            var centerX = view.width / 2;
            var centerY = view.width / 2;
            //Render Major Graduations
            majorGraduationsAngles.forEach(function(pValue, index) {
              var cos1Adj = Math.round(Math.cos((90 - pValue) * Math.PI /
                180) * (innerRadius - majorGraduationMarginTop -
                majorGraduationLength));
              var sin1Adj = Math.round(Math.sin((90 - pValue) * Math.PI /
                180) * (innerRadius - majorGraduationMarginTop -
                majorGraduationLength));
              var cos2Adj = Math.round(Math.cos((90 - pValue) * Math.PI /
                180) * (innerRadius - majorGraduationMarginTop));
              var sin2Adj = Math.round(Math.sin((90 - pValue) * Math.PI /
                180) * (innerRadius - majorGraduationMarginTop));
              var x1 = centerX + cos1Adj;
              var y1 = centerY + sin1Adj * -1;
              var x2 = centerX + cos2Adj;
              var y2 = centerY + sin2Adj * -1;
              svg.append("svg:line")
                .attr("x1", x1)
                .attr("y1", y1)
                .attr("x2", x2)
                .attr("y2", y2)
                .style("stroke", majorGraduationColor);

              renderMinorGraduations(majorGraduationsAngles, index);
            });
          };
          var renderMinorGraduations = function(majorGraduationsAngles,
            indexMajor) {
            var minorGraduationsAngles = [];

            if (indexMajor > 0) {
              var minScale = majorGraduationsAngles[indexMajor - 1];
              var maxScale = majorGraduationsAngles[indexMajor];
              var scaleRange = maxScale - minScale;

              for (var i = 1; i < minorGraduations; i++) {
                var scaleValue = minScale + i * scaleRange /
                  minorGraduations;
                minorGraduationsAngles.push(scaleValue);
              }

              var centerX = view.width / 2;
              var centerY = view.width / 2;
              //Render Minor Graduations
              minorGraduationsAngles.forEach(function(pValue, indexMinor) {
                var cos1Adj = Math.round(Math.cos((90 - pValue) *
                  Math.PI / 180) * (innerRadius -
                  majorGraduationMarginTop -
                  minorGraduationLength));
                var sin1Adj = Math.round(Math.sin((90 - pValue) *
                  Math.PI / 180) * (innerRadius -
                  majorGraduationMarginTop -
                  minorGraduationLength));
                var cos2Adj = Math.round(Math.cos((90 - pValue) *
                  Math.PI / 180) * (innerRadius -
                  majorGraduationMarginTop));
                var sin2Adj = Math.round(Math.sin((90 - pValue) *
                  Math.PI / 180) * (innerRadius -
                  majorGraduationMarginTop));
                var x1 = centerX + cos1Adj;
                var y1 = centerY + sin1Adj * -1;
                var x2 = centerX + cos2Adj;
                var y2 = centerY + sin2Adj * -1;
                svg.append("svg:line")
                  .attr("x1", x1)
                  .attr("y1", y1)
                  .attr("x2", x2)
                  .attr("y2", y2)
                  .style("stroke", minorGraduationColor);
              });
            }
          };
          var getMajorGraduationValues = function(pMinLimit, pMaxLimit,
            pPrecision) {
            var scaleRange = pMaxLimit - pMinLimit;
            var majorGraduationValues = [];
            for (var i = 0; i <= majorGraduations; i++) {
              var scaleValue = pMinLimit + i * scaleRange / (
                majorGraduations);
              majorGraduationValues.push(scaleValue.toFixed(pPrecision));
            }

            return majorGraduationValues;
          };
          var getMajorGraduationAngles = function() {
            var scaleRange = 2 * gaugeAngle;
            var minScale = -1 * gaugeAngle;
            var graduationsAngles = [];
            for (var i = 0; i <= majorGraduations; i++) {
              var scaleValue = minScale + i * scaleRange / (
                majorGraduations);
              graduationsAngles.push(scaleValue);
            }

            return graduationsAngles;
          };
          var getNewAngle = function(pValue) {
            var scale = d3.scale.linear()
              .range([0, 1])
              .domain([minLimit, maxLimit]);
            var ratio = scale(pValue);
            var scaleRange = 2 * gaugeAngle;
            var minScale = -1 * gaugeAngle;
            var newAngle = minScale + (ratio * scaleRange);
            return newAngle;
          };

          var renderGraduationNeedle = function(value, valueUnit, precision,
            minLimit, maxLimit, d3DataSource) {

            svg.selectAll('.mtt-graduation-needle')
              .remove();
            svg.selectAll('.mtt-graduationValueText')
              .remove();
            svg.selectAll('.mtt-graduation-needle-center')
              .remove();

            var centerX = view.width / 2;
            var centerY = view.width / 2;
            var centerColor;

            if (typeof value === 'undefined') {
              centerColor = inactiveColor;
            } else {
              centerColor = needleColor;
              var needleAngle = getNewAngle(value);
              var needleLen = innerRadius - majorGraduationLength -
                majorGraduationMarginTop;
              var needleRadius = (view.width * 2.5) / 300;
              var textSize = isNaN(needleValueTextSize) ? (view.width *
                12) / 300 : needleValueTextSize;
              var fontStyle = textSize + "px Courier";

              if (value >= minLimit && value <= maxLimit) {
                var lineData = [
                  [needleRadius, 0],
                  [0, -needleLen],
                  [-needleRadius, 0],
                  [needleRadius, 0]
                ];
                var defs = svg.append("defs");

                // create filter with id #drop-shadow
                // height=130% so that the shadow is not clipped
                var filter = defs.append("filter")
                  .attr("id", "drop-shadow")
                  .attr("height", "130%")
                  .attr("width", "130%");

                // SourceAlpha refers to opacity of graphic that this filter will be applied to
                // convolve that with a Gaussian with standard deviation 3 and store result
                // in blur
                filter.append("feGaussianBlur")
                  .attr("in", "SourceAlpha")
                  .attr("stdDeviation", 5)
                  .attr("result", "blur");

                // translate output of Gaussian blur to the right and downwards with 2px
                // store result in offsetBlur
                filter.append("feOffset")
                  .attr("in", "blur")
                  .attr("dy", 5)
                  .attr("result", "offsetBlur");

                //COLOR
                filter.append("feFlood")
                  .attr("in", "offsetBlur")
                  .attr("flood-color", "#3d3d3d")
                  .attr("flood-opacity", "0.35")
                  .attr("result", "offsetColor");
                filter.append("feComposite")
                  .attr("in", "offsetColor")
                  .attr("in2", "offsetBlur")
                  .attr("operator", "in")
                  .attr("result", "offsetBlur");

                // overlay original SourceGraphic over translated blurred opacity by using
                // feMerge filter. Order of specifying inputs is important!
                var feMerge = filter.append("feMerge");

                feMerge.append("feMergeNode")
                  .attr("in", "offsetBlur")
                feMerge.append("feMergeNode")
                  .attr("in", "SourceGraphic");
                var pointerLine = d3.svg.line()
                  .interpolate('monotone');

                var pg = svg.append('g')
                  .data([lineData])
                  .attr('class', 'mtt-graduation-needle')
                  .style("fill", 'black')
                  .attr('transform', 'translate(' + centerX + ',' +
                    centerY + ')');
                needle = pg.append('path')
                  .attr('d', pointerLine)
                  .attr('transform', 'rotate(' + needleAngle + ')');
                pg.append("circle")
                  .attr("r", 50)
                  .attr("cy", 0)
                  .attr("cx", 0)
                  .style("filter", "url(#drop-shadow)")
                  .attr("class", "mtt-middleCircle")
                  .attr("fill", getTotalColor(value));
                pg.append("text")
                  .attr("x", "-10")
                  .attr("y", "0")
                  .attr("dy", ".4em")
                  .attr("class", "mtt-graduationValueText")
                  .attr("fill", 'white')
                  .style('font-size', '35px')
                  .attr("text-anchor", "middle")
                  .text(value.toFixed(precision));
                pg.append("text")
                  .attr("x", "30")
                  .attr("y", "8")
                  .attr("dy", ".4em")
                  .attr("class", "mtt-graduationUnitText")
                  .attr("fill", 'white')
                  .style('font-size', '15px')
                  .attr("text-anchor", "middle")
                  .text(valueUnit);
              }
            }

          };
          $window.onresize = function() {
            scope.$apply();
          };
          scope.$watch(function() {
            return angular.element($window)[0].innerWidth;
          }, function() {
            scope.render();
          });

          /* Colin Bester
             Removed watching of data.value as couldn't see reason for this, plus it's the cause of flicker when using
             data=option mode of using directive.
             I'm assuming that calling render function is not what was intended on every value update.
          */
          // scope.$watchCollection('[ranges, data.ranges, data.value]', function () {
          scope.$watchCollection('[ranges, data.ranges]', function() {
            scope.render();
          }, true);

          scope.render = function() {
            updateInternalData();
            svg.selectAll('*')
              .remove();
            if (renderTimeout) clearTimeout(renderTimeout);

            renderTimeout = $timeout(function() {
              var d3DataSource = [];

              if (typeof ranges === 'undefined') {
                d3DataSource.push([minLimit, maxLimit, inactiveColor]);
              } else {
                //Data Generation
                ranges.forEach(function(pValue, index) {
                  d3DataSource.push([pValue.min, pValue.max,
                    pValue.color, pValue.colorHover, pValue.name
                  ]);
                });
              }

              //Render Gauge Color Area
              var translate = "translate(" + view.width / 2 + "," +
                view.width / 2 + ")";
              var cScale = d3.scale.linear()
                .domain([minLimit, maxLimit])
                .range([-1 * gaugeAngle * (Math.PI / 180), gaugeAngle *
                  (Math.PI / 180)
                ]);
              var arc = d3.svg.arc()
                .innerRadius(innerRadius)
                .outerRadius(outerRadius)
                .startAngle(function(d) {
                  return cScale(d[0]);
                })
                .endAngle(function(d) {
                  return cScale(d[1]);
                });

              if (scope.showTip) {
                svg.call(tip);
              }

              scope.mouseover = function() {
                return function(d) {
                  if (scope.showTip) {
                    var name = '',
                      legendClass = 'legend';

                    if (d[4]) {
                      name =
                        '<td class="legendName">' +
                        d[4] + ':</td>';
                      legendClass = 'legendNumber';
                    }

                    tip.html('<table class="tooltipLegend"><tr>' +
                      '<td class="legend-color-guide" style="background-color: ' +
                      d[2] + ';"></td>' + name +
                      '<td class="' + legendClass + '">' + d[0] +
                      ' % to ' +
                      d[1] + ' %</td></tr></table>');
                    tip.show();
                  }

                  d3.select(this)
                    .attr('fill', d[3] || d[2])
                };
              };

              scope.mouseout = function() {
                return function(d) {
                  if (scope.showTip) {
                    tip.hide();
                    d3.selectAll(".d3-tip")
                      .style("opacity", 0);
                  }

                  d3.select(this)
                    .attr('fill', function(d) {
                      return d[2];
                    })
                };
              };

              svg.selectAll("path")
                .data(d3DataSource)
                .enter()
                .append("path")
                .attr("d", arc)
                .on('mousemove', function(event) {
                  if (scope.showTip) {
                    tip.style("top", (d3.event.pageY - 51) + "px")
                      .style("left", (d3.event.pageX - 51) + "px")
                  }

                })
                .on('mouseover', scope.mouseover())
                .on('mouseout', scope.mouseout())
                .attr("fill", function(d) {
                  return d[2];
                })
                .attr("transform", translate);

              var majorGraduationsAngles = getMajorGraduationAngles();
              var majorGraduationValues = getMajorGraduationValues(
                minLimit, maxLimit, majorGraduationPrecision);
              renderMajorGraduations(majorGraduationsAngles);
              renderGraduationNeedle(value, valueUnit, precision,
                minLimit, maxLimit, d3DataSource);
              initialized = true;
            }, 200);

            if (scope.onReady) {
              scope.onReady();
            }
          };
          var onValueChanged = function(pValue, pPrecision, pValueUnit) {
            if (typeof pValue === 'undefined' || pValue == null) return;

            if (needle && pValue >= minLimit && pValue <= maxLimit) {
              var needleAngle = getNewAngle(pValue);
              needle.transition()
                .duration(transitionMs)
                .ease('elastic')
                .attr('transform', 'rotate(' + needleAngle + ')');
              svg.selectAll('.mtt-graduationValueText')
                .text(pValue.toFixed(pPrecision));
              svg.selectAll('.mtt-graduationUnitText')
                .text(pValueUnit);
              svg.selectAll(".mtt-middleCircle")
                .attr("fill", getTotalColor(pValue));
            } else {
              svg.selectAll('.mtt-graduation-needle')
                .remove();
              svg.selectAll('.mtt-graduationValueText')
                .remove();
              svg.selectAll('.mtt-graduation-needle-center')
                .attr("fill", inactiveColor);
            }
          };
          scope.$watchCollection('[value, data.value]', function() {
            if (!initialized) return;
            updateInternalData();
            onValueChanged(value, precision, valueUnit);
          }, true);
        }
      };
    }
  ]);
