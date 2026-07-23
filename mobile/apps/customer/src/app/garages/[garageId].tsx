import { SafeAreaView, StyleSheet, Text, View } from "react-native";
export default function Screen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>garageId</Text>
        <Text style={styles.description}>
          This customer screen is ready for implementation.
        </Text>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9F8",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    color: "#10281F",
    fontSize: 26,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  description: {
    color: "#66756F",
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },
});
