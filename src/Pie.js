import React from "react";
import PropTypes from "prop-types";
import { G, Path, Svg, Text } from "react-native-svg";

function polarToCartesian(cx, cy, r, angle) {
  // Add safety checks for NaN values
  if (isNaN(cx) || isNaN(cy) || isNaN(r) || isNaN(angle)) {
    console.warn('Invalid values in polarToCartesian:', { cx, cy, r, angle });
    return { x: 0, y: 0 };
  }
  
  const a = (angle - 90) * (Math.PI / 180);
  const x = cx + r * Math.cos(a);
  const y = cy + r * Math.sin(a);
  
  return {
    x: isNaN(x) ? 0 : x,
    y: isNaN(y) ? 0 : y,
  };
}

function describeArc(cx, cy, r, startAngle, arcAngle) {
  // Safety checks
  if (isNaN(cx) || isNaN(cy) || isNaN(r) || isNaN(startAngle) || isNaN(arcAngle)) {
    console.warn('Invalid values in describeArc:', { cx, cy, r, startAngle, arcAngle });
    return 'M 0 0'; // Return minimal valid path
  }

  if (arcAngle <= 0) {
    return 'M 0 0'; // Return minimal path for invalid arc
  }

  // Handle full circle case (360 degrees or close to it)
  if (arcAngle >= 359.9) {
    // Draw two semicircles to create a full circle
    const topPoint = polarToCartesian(cx, cy, r, 0);
    const bottomPoint = polarToCartesian(cx, cy, r, 180);
    
    return `M ${topPoint.x} ${topPoint.y}
            A ${r} ${r} 0 0 1 ${bottomPoint.x} ${bottomPoint.y}
            A ${r} ${r} 0 0 1 ${topPoint.x} ${topPoint.y}`;
  }

  const endAngle = startAngle + arcAngle;
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = arcAngle > 180 ? 1 : 0;

  return `M ${start.x} ${start.y}
          A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

const ArcShape = ({
  dimensions,
  color,
  strokeCap,
  startAngle,
  arcAngle,
  isBezian,
}) => {
  const { radius, innerRadius, width } = dimensions;
  
  // Safety checks
  if (!radius || radius <= 0) {
    console.warn('Invalid radius:', radius);
    return null;
  }

  const r = radius - width / 2;
  if (r <= 0) {
    console.warn('Invalid calculated radius:', r);
    return null;
  }

  const pathData = describeArc(radius, radius, r, startAngle || 0, arcAngle || 0);
  const strokeWidth = isBezian ? (arcAngle || 0) * 5 : width;

  return (
    <Path
      d={pathData}
      stroke={color || '#000'}
      strokeWidth={Math.max(strokeWidth, 0)}
      strokeLinecap={strokeCap || 'butt'}
      fill="none"
    />
  );
};

const Background = ({ dimensions, color }) => (
  <ArcShape
    dimensions={dimensions}
    color={color}
    startAngle={0}
    arcAngle={360}
  />
);

const getArcAngle = (percentage) => {
  if (isNaN(percentage) || percentage < 0) return 0;
  return Math.min((percentage / 100) * 360, 360); // Cap at 360 degrees
};

const shouldShowDivider = (sections, dividerSize) =>
  sections?.length > 1 && !Number.isNaN(dividerSize) && dividerSize > 0;

const Sections = ({
  dimensions,
  paintedSections,
  sections,
  shouldShowRoundDividers,
  strokeCapForLargeBands,
}) => {
  // Enhanced safety checks
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return null;
  }

  // Filter out invalid sections
  const validSections = sections.filter(section => {
    return section && 
           typeof section.percentage === 'number' && 
           !isNaN(section.percentage) && 
           section.percentage > 0 && 
           section.color;
  });

  if (validSections.length === 0) {
    return null;
  }

  let startValue = 0;
  const { dividerSize } = dimensions;
  const showDividers = shouldShowDivider(validSections, dividerSize);
  
  return validSections.map((section, idx) => {
    const { percentage, color } = section;
    const startAngle = (startValue / 100) * 360;
    const arcAngle = getArcAngle(percentage);
    startValue += percentage;

    // Skip if arc angle is too small to be visible
    if (arcAngle < 0.1) {
      return null;
    }

    const arcProps = {
      key: idx,
      dimensions,
      color,
      startAngle: showDividers ? startAngle + (dividerSize || 0) : startAngle,
      arcAngle: showDividers ? Math.max(arcAngle - (dividerSize || 0), 0.1) : arcAngle,
      strokeCap: strokeCapForLargeBands,
    };

    if (shouldShowRoundDividers) {
      paintedSections.push({
        percentage,
        color,
        startAngle,
        arcAngle,
      });
    }

    return <ArcShape {...arcProps} />;
  }).filter(Boolean); // Remove null elements
};

const RoundDividers = ({
  dimensions,
  paintedSections,
  backgroundColor,
  visible,
}) => {
  const { dividerSize } = dimensions;
  const dividerOffSet = (dividerSize || 0) * 2 + 6;
  const strokeCap = "butt";
  const isBezian = true;

  if (!(paintedSections?.length > 1 && visible && dividerSize > 0)) return null;

  return (
    <>
      {paintedSections.flatMap((section, index) => {
        const { color, startAngle, arcAngle } = section;
        if (!color || isNaN(startAngle) || isNaN(arcAngle)) return [];
        
        return [...Array(dividerSize + 2).keys()].flatMap((i) => [
          <ArcShape
            key={`${index}-bg-${i}`}
            dimensions={dimensions}
            color={backgroundColor}
            startAngle={startAngle + arcAngle + dividerSize + i - dividerOffSet}
            arcAngle={1}
            isBezian={isBezian}
            strokeCap={strokeCap}
          />,
          <ArcShape
            key={`${index}-fg-${i}`}
            dimensions={dimensions}
            color={color}
            startAngle={startAngle + arcAngle - dividerSize + i - dividerOffSet}
            arcAngle={1}
            isBezian={isBezian}
            strokeCap={strokeCap}
          />,
        ]);
      })}
    </>
  );
};

const CleanUpCircles = ({ dimensions, backgroundColor, visible }) => {
  const { radius, innerRadius, width } = dimensions;

  if (width >= 100 || !visible || !radius || !innerRadius) return null;

  const innerPath = describeArc(
    radius,
    radius,
    Math.max(innerRadius - width / 2, 0),
    0,
    360
  );
  const outerPath = describeArc(
    radius, 
    radius, 
    radius + width / 2, 
    0, 
    360
  );

  return (
    <>
      <Path
        d={innerPath}
        stroke={backgroundColor}
        strokeWidth={width}
        fill="none"
      />
      <Path
        d={outerPath}
        stroke={backgroundColor}
        strokeWidth={width}
        fill="none"
      />
    </>
  );
};

const Pie = ({
  sections,
  radius,
  innerRadius,
  backgroundColor,
  strokeCap,
  dividerSize,
  showCenterText = false,
  centerValue = "",
  centerLabel = "",
}) => {
  // Enhanced prop validation
  const validRadius = Math.max(radius || 50, 10); // Minimum radius of 10
  const validInnerRadius = Math.max(innerRadius || 0, 0);
  const validDividerSize = Math.max(dividerSize || 0, 0);
  
  // Ensure inner radius is less than outer radius
  const finalInnerRadius = Math.min(validInnerRadius, validRadius - 1);
  
  const width = validRadius - finalInnerRadius;
  const dimensions = { 
    radius: validRadius, 
    innerRadius: finalInnerRadius, 
    width, 
    dividerSize: validDividerSize 
  };
  
  const strokeCapForLargeBands = strokeCap === "round" ? "round" : "butt";
  const shouldShowRoundDividers = strokeCap === "round";

  let paintedSections = [];

  return (
    <Svg width={validRadius * 2} height={validRadius * 2}>
      <G rotation={-90} origin={`${validRadius}, ${validRadius}`}>
        <Background dimensions={dimensions} color={backgroundColor} />
        <Sections
          dimensions={dimensions}
          paintedSections={paintedSections}
          sections={sections}
          strokeCapForLargeBands={strokeCapForLargeBands}
          shouldShowRoundDividers={shouldShowRoundDividers}
        />
        <RoundDividers
          dimensions={dimensions}
          paintedSections={paintedSections}
          backgroundColor={backgroundColor}
          visible={shouldShowRoundDividers}
        />
        <CleanUpCircles
          dimensions={dimensions}
          backgroundColor={backgroundColor}
          visible={shouldShowRoundDividers}
        />
      </G>
      
      {/* Center text - only show if requested */}
      {showCenterText && (
        <G>
          <Text
            x={validRadius}
            y={validRadius - 5}
            textAnchor="middle"
            fontSize="24"
            fontWeight="bold"
            fill="#333"
          >
            {centerValue}
          </Text>
          <Text
            x={validRadius}
            y={validRadius + 15}
            textAnchor="middle"
            fontSize="12"
            fill="#666"
          >
            {centerLabel}
          </Text>
        </G>
      )}
    </Svg>
  );
};

export default Pie;

Pie.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.exact({
      percentage: PropTypes.number.isRequired,
      color: PropTypes.string.isRequired,
    })
  ),
  radius: PropTypes.number.isRequired,
  innerRadius: PropTypes.number,
  backgroundColor: PropTypes.string,
  strokeCap: PropTypes.string,
  dividerSize: PropTypes.number,
  showCenterText: PropTypes.bool,
  centerValue: PropTypes.string,
  centerLabel: PropTypes.string,
};

Pie.defaultProps = {
  dividerSize: 0,
  innerRadius: 0,
  backgroundColor: "#fff",
  strokeCap: "butt",
  sections: [],
  showCenterText: false,
  centerValue: "",
  centerLabel: "",
};