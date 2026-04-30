import { useState, useCallback, useMemo } from 'react';
import PricingSheet from '@/components/PricingSheet';
import Dashboard from '@/components/Dashboard';
import ProcurementTable from '@/components/ProcurementTable';
import RoomExplorer from '@/components/RoomExplorer';
import BuildingDrillDown from '@/components/BuildingDrillDown';
import PackageEditor from '@/components/PackageEditor';
import ProjectDataTable from '@/components/ProjectDataTable';
import ItemAssignment from '@/components/ItemAssignment';
import Selections from '@/components/Selections';
import Suppliers from '@/components/Suppliers';
import PublicAreas from '@/components/PublicAreas';
import Standard from '@/components/Standard';
import Catalog from '@/components/Catalog';
import { type UserItemData, loadUserData, saveUserData } from '@/data/projectData';
import {
  MasterRow,
  loadMasterData,
  saveMasterData,
  computeProcurementItems,
  computeTotalItemsCount,
} from '@/data/masterData';

type Tab = 'procurement' | 'standard' | 'rooms' | 'packages' | 'pricing' | 'projectData' | 'itemAssignment' | 'suppliers' | 'catalog' | 'selections' | 'publicAreas';

export default function Index() {
  const [userData, setUserData] = useState<Record<number, UserItemData>>(loadUserData);
  const [masterData, setMasterData] = useState<MasterRow[]>(loadMasterData);
  const [activeTab, setActiveTab] = useState<Tab>('procurement');
  const [drillDownConcept, setDrillDownConcept] = useState<'A' | 'B' | 'C' | null>(null);

  const handleUpdateItem = useCallback((id: number, data: UserItemData) => {
    setUserData((prev) => {
      const next = { ...prev, [id]: data };
      saveUserData(next);
      return next;
    });
  }, []);

  const handleUpdateMasterData = useCallback((data: MasterRow[]) => {
    setMasterData(data);
    saveMasterData(data);
  }, []);

  const procurementItems = useMemo(() => computeProcurementItems(masterData), [masterData]);
  const totalItemsCount = useMemo(() => computeTotalItemsCount(masterData), [masterData]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'procurement', label: 'Procurement' },
    { key: 'standard', label: 'Standard' },
    { key: 'rooms', label: 'Room Explorer' },
    { key: 'packages', label: 'Package Editor' },
    { key: 'pricing', label: 'Pricing Sheet' },
    { key: 'projectData', label: 'Project Data' },
    { key: 'itemAssignment', label: 'Item Assignment' },
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'catalog', label: 'Catalog' },
    { key: 'selections', label: 'Selections' },
    { key: 'publicAreas', label: 'Public Areas' },
  ];

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
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === t.key
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-primary-foreground/70 hover:text-primary-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-primary-foreground/50">338 Units · 9 Buildings · 3 Concepts</span>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1440px] mx-auto px-6 py-6 space-y-8">
        {activeTab !== 'projectData' && activeTab !== 'packages' && activeTab !== 'pricing' && activeTab !== 'publicAreas' && activeTab !== 'standard' && (
          <Dashboard
            onConceptClick={(id) => setDrillDownConcept(id)}
            masterData={masterData}
          />
        )}

        {activeTab === 'procurement' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Procurement List</h2>
              <span className="text-xs text-muted-foreground">All FF&E items across the project</span>
            </div>
            <ProcurementTable
              userData={userData}
              onUpdateItem={handleUpdateItem}
              procurementItems={procurementItems}
              masterData={masterData}
            />
          </div>
        )}

        {activeTab === 'standard' && <Standard />}

        {activeTab === 'rooms' && <RoomExplorer masterData={masterData} />}

        {activeTab === 'packages' && <PackageEditor />}

        {activeTab === 'pricing' && <PricingSheet />}

        {activeTab === 'projectData' && (
          <ProjectDataTable masterData={masterData} onUpdate={handleUpdateMasterData} />
        )}

        {activeTab === 'itemAssignment' && (
          <ItemAssignment masterData={masterData} onUpdate={handleUpdateMasterData} />
        )}

        {activeTab === 'suppliers' && <Suppliers />}

        {activeTab === 'selections' && <Selections />}

        {activeTab === 'publicAreas' && <PublicAreas />}
      </main>

      {/* Building Drill-Down Modal */}
      {drillDownConcept && (
        <BuildingDrillDown
          conceptId={drillDownConcept}
          onClose={() => setDrillDownConcept(null)}
          masterData={masterData}
        />
      )}
    </div>
  );
}
