import { Text, TouchableOpacity } from "react-native";

import { s } from "../styles";
import { C } from "../theme";

export function Btn({
  label,
  onPress,
  disabled,
  variant,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary" | "destructive";
  accessibilityLabel?: string;
}) {
  const bg = variant === "destructive" ? "transparent" : variant === "secondary" ? C.surface : C.green;
  const borderColor = variant === "destructive" ? C.error : variant === "secondary" ? C.border : C.green;
  const textColor = variant === "destructive" ? C.error : variant === "secondary" ? C.white : C.bg;

  return (
    <TouchableOpacity
      style={[s.btn, s.btnFull, { backgroundColor: bg, borderColor }, disabled && s.disabledOpacity]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled === true }}
    >
      <Text style={[s.btnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function TransportBtn({
  label,
  onPress,
  disabled,
  variant,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary";
  accessibilityLabel?: string;
}) {
  const bg = variant === "secondary" ? C.surface : C.green;
  const borderColor = variant === "secondary" ? C.border : C.green;
  const textColor = variant === "secondary" ? C.white : C.bg;

  return (
    <TouchableOpacity
      style={[s.transportBtn, { backgroundColor: bg, borderColor }, disabled && s.disabledOpacity]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled === true }}
    >
      <Text style={[s.btnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}
