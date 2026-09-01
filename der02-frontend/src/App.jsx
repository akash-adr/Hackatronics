import React, { useEffect } from 'react';
import HazardMap from './components/Map/HazardMap';
import DualHazardMap from './components/Map/DualHazardMap';
import MapOverlays from './components/Map/MapOverlays';
import SeverityLegend from './components/Dashboard/SeverityLegend';
import KeyFigures from './components/Dashboard/KeyFigures';
import IncidentSummaryStrip from './components/Dashboard/IncidentSummaryStrip';
import ExplainabilityPanel from './components/Dashboard/ExplainabilityPanel';
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
import SecondFacilityPanel from './components/ConfigPanel/SecondFacilityPanel';
import SectionLabel from './components/ui/SectionLabel';
import Card from './components/ui/Card';
import useFacilityStore from './store/useFacilityStore';

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
  const schemaError = useFacilityStore((s) => s.schemaError);
  const secondFacilityEnabled = useFacilityStore((s) => s.secondFacilityEnabled);

  useEffect(() => {
    // Fetches the config schema, then pre-computes BOTH presets in the
    // background so the comparison panel is populated before it is opened.
    initialize();
  }, [initialize]);

  return (
    <>
      <WidenWindowNotice />

      {/* Locked skeleton: status bar / three columns / summary strip /
          collapsed explainability. The whole thing is h-screen with
          overflow-hidden, so nothing essential can be pushed off-screen or
          require scrolling to reach. */}
      <div className="hidden h-screen w-screen flex-col overflow-hidden bg-canvas font-sans text-ink min-[1280px]:flex">
        <TopStatusBar />
        <HardFailureNotice />
        <FallbackNotice />
        <ChangeAlertBanner />
        {secondFacilityEnabled && <CrossExposureBanner />}

        <main className="flex min-h-0 flex-1 gap-4 p-4">
          {/* LEFT -- Module 4 input panel.
              Capped at 22% rather than 25%: main's padding and the two column
              gaps come out of the centre column's share, so a flat 25% cap
              leaves the map at ~47% on a 1280px screen. 22% keeps it above
              the 50% floor at every supported width. */}
          <aside className="flex w-[min(19rem,22%)] flex-shrink-0 flex-col gap-4 overflow-y-auto">
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

            <SecondFacilityPanel />

            {/* Neutral, not hazard-red: red means "fatal band" on this
                screen and nothing else. */}
            {schemaError && (
              <div className="rounded-card border border-line bg-surface-muted px-4 py-3 text-meta font-medium text-ink">
                Could not load configuration schema: {schemaError}
              </div>
            )}
          </aside>

          {/* CENTRE -- Module 3 map. flex-1 between two 25%-capped panels
              guarantees at least 50% of the width. */}
          <section className="relative min-w-0 flex-1 overflow-hidden rounded-viewport bg-viewport shadow-viewport ring-1 ring-line">
            {secondFacilityEnabled ? <DualHazardMap /> : <HazardMap />}
            <MapOverlays />
          </section>

          {/* RIGHT -- legend + key figures. Same cap as the left column. */}
          <aside className="flex w-[min(19rem,22%)] flex-shrink-0 flex-col gap-4 overflow-y-auto">
            <KeyFigures />
            <SeverityLegend />
          </aside>
        </main>

        <IncidentSummaryStrip />

        {/* Collapsed by default: the one thing allowed to need a click, since
            it is supporting detail rather than an operational figure. */}
        <ExplainabilityPanel />
      </div>
    </>
  );
}

export default App;
