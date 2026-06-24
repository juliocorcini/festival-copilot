import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./app/AppLayout";
import { RequireOnboarding } from "./app/RequireOnboarding";
import { StackLayout } from "./app/StackLayout";
import { NowScreen } from "./routes/NowScreen";
import { TimetableScreen } from "./routes/TimetableScreen";
import { LineupScreen } from "./routes/LineupScreen";
import { MyPlanScreen } from "./routes/MyPlanScreen";
import { MapScreen } from "./routes/MapScreen";
import { SquadScreen } from "./routes/SquadScreen";
import { LockInScreen } from "./routes/lockin/LockInScreen";
import { RouteScreen } from "./routes/RouteScreen";
import { SignInScreen } from "./routes/squad/SignInScreen";
import { ProfileScreen } from "./routes/squad/ProfileScreen";
import { CreateSquadScreen } from "./routes/squad/CreateSquadScreen";
import { InviteScreen } from "./routes/squad/InviteScreen";
import { JoinScreen } from "./routes/squad/JoinScreen";
import { ShareMyPlanScreen } from "./routes/squad/ShareMyPlanScreen";
import { SquadPlanScreen } from "./routes/squad/SquadPlanScreen";
import { SquadBlockScreen } from "./routes/squad/SquadBlockScreen";
import { SquadOverrideScreen } from "./routes/squad/SquadOverrideScreen";
import { SquadBoardScreen } from "./routes/squad/SquadBoardScreen";
import { PresenceConsentScreen } from "./routes/presence/PresenceConsentScreen";
import { WhereScreen } from "./routes/presence/WhereScreen";
import { PreciseSharingScreen } from "./routes/presence/PreciseSharingScreen";
import { VisibilityScreen } from "./routes/presence/VisibilityScreen";
import { LocationPrivacyScreen } from "./routes/presence/LocationPrivacyScreen";
import { MeetSpotScreen } from "./routes/meet/MeetSpotScreen";
import { MeetDetailsScreen } from "./routes/meet/MeetDetailsScreen";
import { MeetDetailScreen } from "./routes/meet/MeetDetailScreen";
import { OnboardingScreen } from "./routes/onboarding/OnboardingScreen";
import { SettingsScreen } from "./routes/settings/SettingsScreen";
import { AppearanceScreen } from "./routes/settings/AppearanceScreen";
import { OfflineScreen } from "./routes/settings/OfflineScreen";
import { AboutScreen } from "./routes/settings/AboutScreen";

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route element={<RequireOnboarding />}>
          <Route element={<AppLayout />}>
            <Route index element={<NowScreen />} />
            <Route path="timetable" element={<TimetableScreen />} />
            <Route path="lineup" element={<LineupScreen />} />
            <Route path="plan" element={<MyPlanScreen />} />
            <Route path="map" element={<MapScreen />} />
            <Route path="squad" element={<SquadScreen />} />
          </Route>
          <Route element={<StackLayout />}>
            <Route path="lockin" element={<LockInScreen />} />
            <Route path="route" element={<RouteScreen />} />
            <Route path="squad/signin" element={<SignInScreen />} />
            <Route path="squad/profile" element={<ProfileScreen />} />
            <Route path="squad/create" element={<CreateSquadScreen />} />
            <Route path="squad/invite/:id" element={<InviteScreen />} />
            <Route path="squad/:id/share" element={<ShareMyPlanScreen />} />
            <Route path="squad/:id/board" element={<SquadBoardScreen />} />
            <Route path="squad/:id/plan" element={<SquadPlanScreen />} />
            <Route path="squad/:id/plan/:perfId" element={<SquadBlockScreen />} />
            <Route path="squad/:id/plan/:perfId/override" element={<SquadOverrideScreen />} />
            <Route path="squad/:id/location" element={<PresenceConsentScreen />} />
            <Route path="squad/:id/where" element={<WhereScreen />} />
            <Route path="squad/:id/meet" element={<MeetSpotScreen />} />
            <Route path="squad/:id/meet/new" element={<MeetDetailsScreen />} />
            <Route path="squad/:id/meet/:mpId" element={<MeetDetailScreen />} />
            <Route path="squad/:id/precise" element={<PreciseSharingScreen />} />
            <Route path="squad/:id/visibility" element={<VisibilityScreen />} />
            <Route path="squad/join" element={<JoinScreen />} />
            <Route path="squad/join/:token" element={<JoinScreen />} />
            <Route path="j/:token" element={<JoinScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="settings/appearance" element={<AppearanceScreen />} />
            <Route path="settings/offline" element={<OfflineScreen />} />
            <Route path="settings/privacy" element={<LocationPrivacyScreen />} />
            <Route path="settings/about" element={<AboutScreen />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
