import { lazy, type ComponentType } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./app/AppLayout";
import { UpdateBanner } from "./app/UpdateBanner";
import { RouteAnnouncer } from "./app/RouteAnnouncer";
import { SkipLink } from "./app/SkipLink";
import { Toaster } from "./ui/Toaster";
import { RequireOnboarding } from "./app/RequireOnboarding";
import { StackLayout } from "./app/StackLayout";
import { OnboardingScreen } from "./routes/onboarding/OnboardingScreen";
// Hot path stays eager (first paint for a solo day-1 user): the 4 primary tabs + onboarding +
// shells. Every other cluster (map, lock-in, the whole squad/presence/meet flow, settings, admin)
// is code-split so it only costs bytes when first reached. Layouts wrap their <Outlet/> in a
// Suspense boundary, so the lazy screens below need no per-route fallback.
import { NowScreen } from "./routes/NowScreen";
import { TimetableScreen } from "./routes/TimetableScreen";
import { LineupScreen } from "./routes/LineupScreen";
import { MyPlanScreen } from "./routes/MyPlanScreen";
import { AdminGate } from "./admin/AdminGate";
import { AdminLayout } from "./admin/AdminLayout";

const named = <T extends Record<string, unknown>, K extends keyof T>(p: Promise<T>, key: K) =>
  p.then((m) => ({ default: m[key] as unknown as ComponentType }));

const MapScreen = lazy(() => named(import("./routes/MapScreen"), "MapScreen"));
const SquadScreen = lazy(() => named(import("./routes/SquadScreen"), "SquadScreen"));
const LockInScreen = lazy(() => named(import("./routes/lockin/LockInScreen"), "LockInScreen"));
const RouteScreen = lazy(() => named(import("./routes/RouteScreen"), "RouteScreen"));
const SignInScreen = lazy(() => named(import("./routes/squad/SignInScreen"), "SignInScreen"));
const ProfileScreen = lazy(() => named(import("./routes/squad/ProfileScreen"), "ProfileScreen"));
const CreateSquadScreen = lazy(() => named(import("./routes/squad/CreateSquadScreen"), "CreateSquadScreen"));
const InviteScreen = lazy(() => named(import("./routes/squad/InviteScreen"), "InviteScreen"));
const JoinScreen = lazy(() => named(import("./routes/squad/JoinScreen"), "JoinScreen"));
const ShareMyPlanScreen = lazy(() => named(import("./routes/squad/ShareMyPlanScreen"), "ShareMyPlanScreen"));
const SquadPlanScreen = lazy(() => named(import("./routes/squad/SquadPlanScreen"), "SquadPlanScreen"));
const SquadBlockScreen = lazy(() => named(import("./routes/squad/SquadBlockScreen"), "SquadBlockScreen"));
const SquadSplitScreen = lazy(() => named(import("./routes/squad/SquadSplitScreen"), "SquadSplitScreen"));
const SquadOverrideScreen = lazy(() => named(import("./routes/squad/SquadOverrideScreen"), "SquadOverrideScreen"));
const SquadBoardScreen = lazy(() => named(import("./routes/squad/SquadBoardScreen"), "SquadBoardScreen"));
const SquadEventsScreen = lazy(() => named(import("./routes/squad/SquadEventsScreen"), "SquadEventsScreen"));
const PresenceConsentScreen = lazy(() => named(import("./routes/presence/PresenceConsentScreen"), "PresenceConsentScreen"));
const WhereScreen = lazy(() => named(import("./routes/presence/WhereScreen"), "WhereScreen"));
const PreciseSharingScreen = lazy(() => named(import("./routes/presence/PreciseSharingScreen"), "PreciseSharingScreen"));
const VisibilityScreen = lazy(() => named(import("./routes/presence/VisibilityScreen"), "VisibilityScreen"));
const LocationPrivacyScreen = lazy(() => named(import("./routes/presence/LocationPrivacyScreen"), "LocationPrivacyScreen"));
const MeetSpotScreen = lazy(() => named(import("./routes/meet/MeetSpotScreen"), "MeetSpotScreen"));
const MeetDetailsScreen = lazy(() => named(import("./routes/meet/MeetDetailsScreen"), "MeetDetailsScreen"));
const MeetDetailScreen = lazy(() => named(import("./routes/meet/MeetDetailScreen"), "MeetDetailScreen"));
const MeetNavScreen = lazy(() => named(import("./routes/meet/MeetNavScreen"), "MeetNavScreen"));
const SafetyScreen = lazy(() => named(import("./routes/meet/SafetyScreen"), "SafetyScreen"));
const SettingsScreen = lazy(() => named(import("./routes/settings/SettingsScreen"), "SettingsScreen"));
const AppearanceScreen = lazy(() => named(import("./routes/settings/AppearanceScreen"), "AppearanceScreen"));
const OfflineScreen = lazy(() => named(import("./routes/settings/OfflineScreen"), "OfflineScreen"));
const AboutScreen = lazy(() => named(import("./routes/settings/AboutScreen"), "AboutScreen"));
const FestivalScreen = lazy(() => named(import("./routes/settings/FestivalScreen"), "FestivalScreen"));

const AdminFestivalsScreen = lazy(() => named(import("./admin/AdminFestivalsScreen"), "AdminFestivalsScreen"));
const AdminLineupScreen = lazy(() => named(import("./admin/AdminLineupScreen"), "AdminLineupScreen"));
const AdminDataSourceScreen = lazy(() => named(import("./admin/AdminDataSourceScreen"), "AdminDataSourceScreen"));
const AdminMetricsScreen = lazy(() => named(import("./admin/AdminMetricsScreen"), "AdminMetricsScreen"));
const AdminTestConsoleScreen = lazy(() => named(import("./admin/AdminTestConsoleScreen"), "AdminTestConsoleScreen"));
const AdminSuggestionsScreen = lazy(() => named(import("./admin/AdminSuggestionsScreen"), "AdminSuggestionsScreen"));
const AdminMapEditorScreen = lazy(() => named(import("./admin/AdminMapEditorScreen"), "AdminMapEditorScreen"));

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <SkipLink />
      <RouteAnnouncer />
      <UpdateBanner />
      <Toaster />
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
            <Route path="squad/:id/events" element={<SquadEventsScreen />} />
            <Route path="squad/:id/plan" element={<SquadPlanScreen />} />
            <Route path="squad/:id/plan/:perfId" element={<SquadBlockScreen />} />
            <Route path="squad/:id/plan/:perfId/split" element={<SquadSplitScreen />} />
            <Route path="squad/:id/plan/:perfId/override" element={<SquadOverrideScreen />} />
            <Route path="squad/:id/location" element={<PresenceConsentScreen />} />
            <Route path="squad/:id/where" element={<WhereScreen />} />
            <Route path="squad/:id/meet" element={<MeetSpotScreen />} />
            <Route path="squad/:id/meet/new" element={<MeetDetailsScreen />} />
            <Route path="squad/:id/meet/:mpId" element={<MeetDetailScreen />} />
            <Route path="squad/:id/meet/:mpId/nav" element={<MeetNavScreen />} />
            <Route path="squad/:id/safety" element={<SafetyScreen />} />
            <Route path="squad/:id/precise" element={<PreciseSharingScreen />} />
            <Route path="squad/:id/visibility" element={<VisibilityScreen />} />
            <Route path="squad/join" element={<JoinScreen />} />
            <Route path="squad/join/:token" element={<JoinScreen />} />
            <Route path="j/:token" element={<JoinScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="settings/festival" element={<FestivalScreen />} />
            <Route path="settings/appearance" element={<AppearanceScreen />} />
            <Route path="settings/offline" element={<OfflineScreen />} />
            <Route path="settings/privacy" element={<LocationPrivacyScreen />} />
            <Route path="settings/about" element={<AboutScreen />} />
          </Route>
        </Route>
        <Route path="/admin" element={<AdminGate />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminFestivalsScreen />} />
            <Route path="festivals/:id/map" element={<AdminMapEditorScreen />} />
            <Route path="lineup" element={<AdminLineupScreen />} />
            <Route path="data-sources" element={<AdminDataSourceScreen />} />
            <Route path="metrics" element={<AdminMetricsScreen />} />
            <Route path="test-console" element={<AdminTestConsoleScreen />} />
            <Route path="suggestions" element={<AdminSuggestionsScreen />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
