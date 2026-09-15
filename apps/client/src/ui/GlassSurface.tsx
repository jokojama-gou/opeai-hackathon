import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  View,
  type ViewStyle,
} from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
export function GlassSurface({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduced,
    );
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  const supported =
    Platform.OS === "ios" &&
    !reduced &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  return supported ? (
    <GlassView glassEffectStyle="regular" style={style}>
      {children}
    </GlassView>
  ) : (
    <View style={[{ backgroundColor: "#f9fbf7" }, style]}>{children}</View>
  );
}
