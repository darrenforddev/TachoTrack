import { Pressable, StyleSheet, Text, View } from "react-native";

interface WeeklyExtensionPersistenceSimulatorProps {
  onAddExtendedDay: () => void;
  onResetWeek: () => void;
}

export default function WeeklyExtensionPersistenceSimulator({
  onAddExtendedDay,
  onResetWeek,
}: WeeklyExtensionPersistenceSimulatorProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Weekly Extension Persistence Test</Text>

      <Text style={styles.subtitle}>
        Development only — used to test saved 10h extension history
      </Text>

      <View style={styles.row}>
        <Pressable style={styles.button} onPress={onAddExtendedDay}>
          <Text style={styles.buttonText}>Add 9h30 Extended Day</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={onResetWeek}>
          <Text style={styles.buttonText}>Reset Test Week</Text>
        </Pressable>
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
    borderColor: "#258cff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
});
