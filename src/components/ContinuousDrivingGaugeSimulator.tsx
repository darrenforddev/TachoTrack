import { Pressable, StyleSheet, Text, View } from "react-native";

interface GaugePreset {
  label: string;
  usedMinutes: number;
}

interface ContinuousDrivingGaugeSimulatorProps {
  onSelect: (usedMinutes: number | null) => void;
  activeUsedMinutes: number | null;
}

const presets: GaugePreset[] = [
  {
    label: "Live",
    usedMinutes: -1,
  },
  {
    label: "0h",
    usedMinutes: 0,
  },
  {
    label: "1h",
    usedMinutes: 60,
  },
  {
    label: "2h15",
    usedMinutes: 135,
  },
  {
    label: "3h30",
    usedMinutes: 210,
  },
  {
    label: "4h00",
    usedMinutes: 240,
  },
  {
    label: "4h30",
    usedMinutes: 270,
  },
  {
    label: "4h31",
    usedMinutes: 271,
  },
];

export default function ContinuousDrivingGaugeSimulator({
  onSelect,
  activeUsedMinutes,
}: ContinuousDrivingGaugeSimulatorProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Gauge Simulator</Text>

      <Text style={styles.subtitle}>
        Development only — does not alter driver history
      </Text>

      <View style={styles.row}>
        {presets.map((preset) => {
          const isLive = preset.usedMinutes === -1;

          const isActive = isLive
            ? activeUsedMinutes === null
            : activeUsedMinutes === preset.usedMinutes;

          return (
            <Pressable
              key={preset.label}
              onPress={() => onSelect(isLive ? null : preset.usedMinutes)}
              style={[styles.button, isActive && styles.buttonActive]}
            >
              <Text
                style={[styles.buttonText, isActive && styles.buttonTextActive]}
              >
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: "#081523",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },

  title: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  subtitle: {
    color: "#8293a8",
    fontSize: 12,
  },

  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  button: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  buttonActive: {
    backgroundColor: "#0d3159",
    borderColor: "#258cff",
  },

  buttonText: {
    color: "#95a8bc",
    fontSize: 12,
    fontWeight: "800",
  },

  buttonTextActive: {
    color: "#ffffff",
  },
});
