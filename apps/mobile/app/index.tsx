import { Redirect } from "expo-router";

export default function Index() {
  // Every cold start shares the same visual first frame. Login decides whether to reveal its
  // controls or continue the restored-session transition after secure storage has hydrated.
  return <Redirect href="/login" />;
}
