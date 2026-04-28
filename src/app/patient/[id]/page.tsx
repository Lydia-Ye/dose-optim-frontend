"use client"

import { useState, useEffect, use } from "react";
import { notFound } from "next/navigation";

import { Patient } from "@/types/patient";
import PastPatientPage from "@/components/PastPatientPage";
import NewPatientPage from "@/components/NewPatientPage";

interface PatientPageProps {
  params: Promise<{ id: string }>;
}

export default function PatientPage({ params }: PatientPageProps) {
  // Obtain ID parameter.
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  // Patient information.
  const [patient, setPatient] = useState<Patient|null>(null);

  // Page is loading while patient data is being fetched.
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(`/api/patients/${id}`, { cache: "no-store" })
      .then((res) => {
        if (res.status === 404) return notFound();
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setPatient(data as Patient);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading patient:", error);
        setLoading(false);
      });
  }, [id]);

  return (
    <div>
      {loading || !patient ? 
        (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-lg text-gray-600 font-medium">Loading patient data...</p>
            </div>
          </div>
        ) 
        : 
        (
          <>
            {patient.past ? 
              (
                <PastPatientPage patient={patient} />
              ) 
              : 
              (
                <NewPatientPage patient={patient} setPatient={setPatient} />         
              )
            } 
          </>         
        )
      }    
    </div>
  );
}
