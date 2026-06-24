import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./app/AppLayout";
import { StackLayout } from "./app/StackLayout";
import { NowScreen } from "./routes/NowScreen";
import { TimetableScreen } from "./routes/TimetableScreen";
import { MyPlanScreen } from "./routes/MyPlanScreen";
import { MapScreen } from "./routes/MapScreen";
import { SquadScreen } from "./routes/SquadScreen";
import { SettingsScreen } from "./routes/settings/SettingsScreen";
import { AppearanceScreen } from "./routes/settings/AppearanceScreen";
import { OfflineScreen } from "./routes/settings/OfflineScreen";

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<NowScreen />} />
          <Route path="timetable" element={<TimetableScreen />} />
          <Route path="plan" element={<MyPlanScreen />} />
          <Route path="map" element={<MapScreen />} />
          <Route path="squad" element={<SquadScreen />} />
        </Route>
        <Route element={<StackLayout />}>
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="settings/appearance" element={<AppearanceScreen />} />
          <Route path="settings/offline" element={<OfflineScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
