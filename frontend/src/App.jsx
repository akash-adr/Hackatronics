import React, { useEffect } from 'react';
import HazardMap from './components/Map/HazardMap';
import DualHazardMap from './components/Map/DualHazardMap';
import MapOverlays from './components/Map/MapOverlays';
import SeverityLegend from './components/Dashboard/SeverityLegend';
import KeyFigures from './components/Dashboard/KeyFigures';
import IncidentSummaryStrip from './components/Dashboard/IncidentSummaryStrip';
import InsightsSection from './components/Dashboard/InsightsSection';
import TopStatusBar from './components/Dashboard/TopStatusBar';
import ChangeAlertBanner from './components/Dashboard/ChangeAlertBanner';
import CrossExposureBanner from './components/Dashboard/CrossExposureBanner';
import {
  FallbackNotice,
  HardFailureNotice,
} from './components/Dashboard/ResilienceNotices';
import FacilitySelector from './components/ConfigPanel/FacilitySelector';
import CustomFacilityForm from './components/ConfigPanel/CustomFacilityForm';
import ComparisonView from './components/ConfigPanel/ComparisonView';
import IncidentTimeline from './components/Dashboard/IncidentTimeline';
import WorstMomentCard from './components/Dashboard/WorstMomentCard';
import SecondFacilityPanel from './components/ConfigPanel/SecondFacilityPanel';
import SectionLabel from './components/ui/SectionLabel';
import Card from './components/ui/Card';
import useFacilityStore from './store/useFacilityStore';
import useThemeStore from './store/useThemeStore';

// Below this width the three-column layout stops being honest -- the map
// would fall under its 50% floor. This is a laptop/projector demo tool, so
// the narrow case gets a clear notice rather than a compromised layout.
const MIN_SUPPORTED_WIDTH = 1280;

function WidenWindowNotice() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-canvas p-8 min-[1280px]:hidden">
      <div className="max-w-sm text-center">
        <h1 className="text-section font-semibold text-ink">
          Widen your window
        </h1>
        <p className="mt-2 text-body text-subtle">
          The incident dashboard needs at least {MIN_SUPPORTED_WIDTH}px of width
          so the map keeps at least half the screen. Resize the window or use a
          larger display.
        </p>
      </div>
    </div>
  );
}

function App() {
  const initialize = useFacilityStore((s) => s.initialize);
  const initializeTheme = useThemeStore((s) => s.initializeTheme);
  const schemaError = useFacilityStore((s) => s.schemaError);
  const secondFacilityEnabled = useFacilityStore((s) => s.secondFacilityEnabled);
  const simulating = useFacilityStore((s) => s.simulating);

  useEffect(() => {
    // Reapplies the saved light/dark choice before the first paint settles.
    initializeTheme();
  }, [initializeTheme]);

  useEffect(() => {
    // Fetches the config schema, then pre-computes BOTH presets in the
    // background so the comparison panel is populated before it is opened.
    initialize();
  }, [initialize]);

  return (
    <>
      <WidenWindowNotice />

      {/* Skeleton: status bar / three columns / summary strip, then the
          four insight blocks below. The operational half still fills the first
          screen -- the map band is sized to the viewport -- but the page now
          scrolls, because the blocks below are meant to be read, not expanded. */}
      <div className="hidden min-h-screen w-full flex-col bg-canvas font-sans text-ink min-[1280px]:flex">
        <TopStatusBar />
        <HardFailureNotice />
        <FallbackNotice />
        <ChangeAlertBanner />
        {secondFacilityEnabled && <CrossExposureBanner />}

        <main className="flex min-h-0 flex-shrink-0 gap-4 p-4 h-[calc(100vh-8.5rem)]">
          {/* LEFT -- Module 4 input panel.
              Capped at 22% rather than 25%: main's padding and the two column
              gaps come out of the centre column's share, so a flat 25% cap
              leaves the map at ~47% on a 1280px screen. 22% keeps it above
              the 50% floor at every supported width. */}
          <aside
            className={`flex w-[min(23rem,24%)] flex-shrink-0 flex-col gap-4 overflow-y-auto transition-opacity ${simulating ? 'pointer-events-none opacity-60' : ''}`}
          >
            <Card>
              <SectionLabel>Scenario</SectionLabel>
              <div className="mt-4">
                <FacilitySelector />
              </div>
            </Card>

            <Card>
              <SectionLabel>Facility &amp; weather</SectionLabel>
              <div className="mt-4">
                <CustomFacilityForm />
              </div>
            </Card>

            <ComparisonView />

            <IncidentTimeline />
            <WorstMomentCard />

            <SecondFacilityPanel />

            {/* Neutral, not hazard-red: red means "fatal band" on this
                screen and nothing else. */}
            {schemaError && (
              <div className="rounded-card border border-line bg-surface-muted px-4 py-3 text-meta font-medium text-ink">
                Could not load configuration schema: {schemaError}
              </div>
            )}
          </aside>

          {/* CENTRE -- Module 3 map, now a SQUARE viewport rather than a band
              stretched to whatever the flex row left over.
              Sizing rule: width = min(space available, the row's own height),
              with aspect-square deriving the height from it. Driving off WIDTH
              (not height) is what keeps it square at every window size -- if
              height drove it, a narrow window would clamp the width and the
              square would flatten back into a rectangle.
              The leftover width on wide screens becomes deliberate symmetric
              whitespace: the square is centred, not stretched. This does mean
              the map no longer holds Module 5's "at least 50% of the width" on
              very wide displays -- a square was the explicit ask. */}
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <section className="relative aspect-square w-[min(100%,calc(100vh-8.5rem))] overflow-hidden rounded-viewport bg-viewport shadow-viewport ring-1 ring-line">
              {secondFacilityEnabled ? <DualHazardMap /> : <HazardMap />}
              <MapOverlays />
            </section>
          </div>

          {/* RIGHT -- legend + key figures. Same cap as the left column. */}
          <aside
            className={`flex w-[min(23rem,24%)] flex-shrink-0 flex-col gap-4 overflow-y-auto transition-opacity ${simulating ? 'pointer-events-none opacity-60' : ''}`}
          >
            <KeyFigures />
            <SeverityLegend />
          </aside>
        </main>

        <IncidentSummaryStrip />

        {/* Hazard summary, threat level, explanation, recent alerts. */}
        <InsightsSection />
      </div>
    </>
  );
}

export default App;
