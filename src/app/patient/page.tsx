"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import PatientAddForm from "@/components/PatientAddForm";
import DataTable from "react-data-table-component";
import { Patient } from "@/types/patient";
import { TableRow } from "@/types/tableRow";

export default function AllPatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [filteredTableData, setFilteredTableData] = useState<TableRow[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    let base = tableData;
    if (statusFilter === "Active") base = tableData.filter(r => !r.past);
    else if (statusFilter === "Past") base = tableData.filter(r => r.past);

    if (nameFilter) {
      base = base.filter(r => r.name.toLowerCase().includes(nameFilter.toLowerCase()));
    }
    setFilteredTableData(base);
  }, [nameFilter, statusFilter, tableData]);


  const columns = [
    {
      name: "Patient ID",
      selector: (row: TableRow) => row.name,
      cell: (row: TableRow) => (
        <div onClick={() => router.push(`/patient/${row.id}`)} className="cursor-pointer font-medium text-[var(--foreground)] hover:text-[var(--color-primary)]">
          {row.name}
        </div>
      ),
    },
    {
      name: "Status",
      selector: (row: TableRow) => row.past,
      cell: (row: TableRow) => (
        <span
          className={`px-3 py-1 text-xs rounded-full font-medium ${
            row.past ? 'bg-red-100 text-red-800' : 'bg-lime-200 text-green-900'
          }`}
        >
          {row.past ? 'Past Patient' : 'Active Patient'}
        </span>
      ),
    },
  ];

  useEffect(() => {
    fetch("/api/patients")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setPatients(data); })
      .catch((error) => console.error("Error loading patients:", error));
  }, []);

  useEffect(() => {
    const newTableData = patients.map((item) => ({
      id: item.id,
      name: item.name,
      past: item.past,
    }));
    setTableData(newTableData);
    setFilteredTableData(newTableData);
  }, [patients]);

  const subHeaderComponent = (
    <div className="flex w-full justify-between items-center gap-4 flex-wrap">
      <div className="flex bg-[var(--color-muted)] rounded-full overflow-hidden">
        {['All', 'Active', 'Past'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === tab
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--foreground)] hover:bg-[var(--color-primary)] hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={nameFilter}
        onChange={(e) => setNameFilter(e.target.value)}
        placeholder="Search by ID..."
        className="px-4 py-2 border border-[var(--color-border)] rounded-full text-sm w-64 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
    </div>
  );

  return (
    <div className="w-full max-w-screen-xl mx-auto px-6 py-12">
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-xl w-full text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Add New Patient</h2>
              <button
                onClick={() => setShowForm(false)}
                className="bg-red-500 text-white px-4 py-2 text-sm rounded-full hover:bg-red-600"
              >
                Close
              </button>
            </div>
            <PatientAddForm patients={patients} setPatients={setPatients} setShowForm={setShowForm} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-10">
      {/* Side Panel */}
      <div className="rounded-2xl p-6 flex flex-col gap-6 bg-transparent border border-[var(--color-border)] shadow-none max-h-[400px] overflow-auto">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Patient Dashboard</h1>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 pl-2">
            <li>View and manage all registered patients</li>
            <li>Click a Patient ID to explore treatment plans</li>
            <li>Compare past and active rehabilitation cases</li>
          </ul>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="bg-[var(--color-primary)] text-white text-sm font-medium px-5 py-2.5 rounded-full w-full"
        >
          + Add Patient
        </button>

        <div className="border-t border-[var(--color-border)] pt-4">
          <ul className="list-disc list-inside text-sm text-gray-400 pl-2 space-y-1">
            <li>Use the tabs above the table to filter by status</li>
            <li>Use the search bar to locate patients by ID</li>
          </ul>
        </div>
      </div>


        {/* Data Table */}
        <div className="w-full border border-[var(--color-border)] rounded-2xl shadow-sm overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredTableData}
            pagination
            dense
            subHeader
            subHeaderComponent={subHeaderComponent}
            customStyles={{
              headRow: {
                style: {
                  backgroundColor: "var(--color-muted)",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                },
              },
              rows: {
                style: {
                  minHeight: "4.5rem",
                  paddingTop: "0.5rem",
                  paddingBottom: "0.5rem",
                },
                highlightOnHoverStyle: {
                  backgroundColor: "var(--color-muted)",
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
