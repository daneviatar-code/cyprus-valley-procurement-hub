import { useState, useCallback } from 'react';
import Dashboard from '@/components/Dashboard';
import ProcurementTable from '@/components/ProcurementTable';
import RoomExplorer from '@/components/RoomExplorer';
import BuildingDrillDown from '@/components/BuildingDrillDown';
import { UserItemData, loadUserData, saveUserData } from '@/data/projectData';

type Tab = 'procurement' | 'rooms';

export default function Index() {
  const [userData, setUserData] = useState<Record<number, UserItemData>>(loadUserData);
  const [activeTab, setActiveTab] = useState<Tab>('procurement');
  const [drillDownConcept, setDrillDownConcept] = useState<'A' | 'B' | 'C' | null>(null);

  const handleUpdateItem = useCallback((id: number, data: UserItemData) => {
    setUserData((prev) => {
      const next = { ...prev, [id]: data };
      saveUserData(next);
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-primary">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center">
              <span className="text-sm font-bold text-accent-foreground">CV</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-primary-foreground tracking-wide">CYPRUS VALLEY</h1>
              <p className="text-[10px] text-primary-foreground/60 uppercase tracking-widest">Procurement Management</p>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex items-center gap-1 bg-primary-foreground/10 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('procurement')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'procurement'
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-primary-foreground/70 hover:text-primary-foreground'
              }`}
            >
              Procurement
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'rooms'
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-primary-foreground/70 hover:text-primary-foreground'
              }`}
            >
              Room Explorer
            </button>
          </div>

          <span className="text-xs text-primary-foreground/50">338 Units · 9 Buildings · 3 Concepts</span>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1440px] mx-auto px-6 py-6 space-y-8">
        <Dashboard onConceptClick={(id) => setDrillDownConcept(id)} />

        {activeTab === 'procurement' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Procurement List</h2>
              <span className="text-xs text-muted-foreground">All FF&E items across the project</span>
            </div>
            <ProcurementTable userData={userData} onUpdateItem={handleUpdateItem} />
          </div>
        )}

        {activeTab === 'rooms' && <RoomExplorer />}
      </main>

      {/* Building Drill-Down Modal */}
      {drillDownConcept && (
        <BuildingDrillDown
          conceptId={drillDownConcept}
          onClose={() => setDrillDownConcept(null)}
        />
      )}
    </div>
  );
}
