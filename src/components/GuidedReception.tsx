/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  CameraPhoto,
  DossierSAV,
  DossierStatus,
  DossierPriority,
  InterventionType,
  PHOTO_CATEGORIES,
  PhotoCategory,
  UserRole,
  VehicleMasterRecord,
  VehicleMasterImportResult
} from "../types";
import { createReceptionDossier } from "../sav-core";
import { fileToCameraPhoto } from "../photo-utils";
import { 
  Users, 
  Car, 
  FileText, 
  Camera, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Upload, 
  ClipboardCheck, 
  Sparkles,
  Percent,
  Plus,
  Search,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { LicencePlate } from "./UIParts";
import {
  canManageVehicleMaster,
  canSearchVehicleMaster,
  canUseVehicleForReception,
  canViewVehicleSensitiveFields
} from "../permissions";
import {
  parseVehicleMasterCsv,
  searchVehicleMaster,
  getVehicleWarrantyStatus,
  getVehicleReceptionHints
} from "../vehicle-master";

interface GuidedReceptionProps {
  dossiers: DossierSAV[];
  existingDossierIds: string[];
  onAddDossier: (dossier: DossierSAV) => void;
  onNavigateToTab: (tab: string) => void;
  vehicleMasterRecords: VehicleMasterRecord[];
  vehicleMasterLastImport: string | null;
  onUpdateVehicleMaster: (records: VehicleMasterRecord[]) => void;
  onClearVehicleMaster: () => void;
  currentUserRole: UserRole;
  onSelectDossier?: (id: string) => void;
}

const PRESET_CLIENTS = [
  { nom: "Client Démo Flotte 001", tel: "+216 55 111 001" },
  { nom: "Client Démo Particulier 002", tel: "+216 55 111 002" },
  { nom: "Société Démo Transport 003", tel: "+216 55 111 003" }
];

const PRESET_MODELS = [
  { marque: "DFSK", modele: "Glory 500", testId: "preset-model-glory-500" },
  { marque: "DFSK", modele: "Glory 580", testId: "preset-model-glory-580" },
  { marque: "DFSK", modele: "E5", testId: "preset-model-e5" },
  { marque: "DFSK", modele: "BOX", testId: "preset-model-box" },
  { marque: "Dongfeng", modele: "Shine", testId: "preset-model-shine" },
  { marque: "Dongfeng", modele: "Shine Max", testId: "preset-model-shine-max" },
  { marque: "Forthing", modele: "T5 EVO", testId: "preset-model-t5-evo" },
  { marque: "Forthing", modele: "Friday", testId: "preset-model-friday" }
];

const PRESET_COMPLAINTS = [
  { text: "Entretien périodique / Vidange", testId: "preset-complaint-entretien" },
  { text: "Bruit train avant", testId: "preset-complaint-train-avant" },
  { text: "Climatisation inefficace", testId: "preset-complaint-climatisation" },
  { text: "Voyant moteur allumé", testId: "preset-complaint-voyant-moteur" },
  { text: "Problème de charge", testId: "preset-complaint-charge" },
  { text: "Bruit freinage", testId: "preset-complaint-freinage" },
  { text: "Contrôle avant livraison", testId: "preset-complaint-pdi" },
  { text: "Perte de puissance", testId: "preset-complaint-puissance" }
];

export default function GuidedReception({
  dossiers,
  existingDossierIds,
  onAddDossier,
  onNavigateToTab,
  vehicleMasterRecords,
  vehicleMasterLastImport,
  onUpdateVehicleMaster,
  onClearVehicleMaster,
  currentUserRole,
  onSelectDossier
}: GuidedReceptionProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [receptionError, setReceptionError] = useState<string | null>(null);

  // Vehicle Master states
  const [vehicleMasterPanelOpen, setVehicleMasterPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VehicleMasterRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [importResult, setImportResult] = useState<VehicleMasterImportResult | null>(null);
  const [showOverwriteConfirmation, setShowOverwriteConfirmation] = useState(false);
  const [pendingVehicleToUse, setPendingVehicleToUse] = useState<VehicleMasterRecord | null>(null);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [plateMultipleMatches, setPlateMultipleMatches] = useState<VehicleMasterRecord[]>([]);
  const [activeDuplicateDossier, setActiveDuplicateDossier] = useState<DossierSAV | null>(null);

  const handleSearchVehicle = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    const results = searchVehicleMaster(vehicleMasterRecords, q);
    setSearchResults(results);
    setHasSearched(true);
  };

  const handleImportCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const result = parseVehicleMasterCsv(text);
        setImportResult(result);
        if (result.records.length > 0) {
          onUpdateVehicleMaster(result.records);
        }
      };
      reader.readAsText(files[0]);
    }
    e.target.value = "";
  };

  const handleUseVehicleMasterRecord = (vehicle: VehicleMasterRecord) => {
    const maskedPhone = vehicle.customerPhone 
      ? vehicle.customerPhone.substring(0, 4) + "****" + vehicle.customerPhone.substring(vehicle.customerPhone.length - 3) 
      : "aucun";
    console.debug(`[VehicleMaster] Utilisation du véhicule VIN: ${vehicle.vin}, Client: ${vehicle.customerName}, Tél: ${maskedPhone}`);

    const hints = getVehicleReceptionHints(vehicle, new Date());

    updateClientNom(vehicle.customerName || "");
    updateClientTelephone(vehicle.customerPhone || "");
    setVehiculeMarque(vehicle.brand || "Dongfeng");
    setVehiculeModele(vehicle.model || "");
    setVehiculeVersion(vehicle.version || "");
    setVehiculeVIN(vehicle.vin || "");
    setVehiculeImmatriculation(vehicle.plateNumber || "");
    setVehiculeDateLivraison(vehicle.deliveryDate || "");
    setVehiculeDateMiseCirculation(vehicle.circulationDate || "");
    setVehiculeStatutGarantie(hints.warrantyStatus || "Garantie inconnue");
    setVehiculeDernierEntretien(hints.lastServiceInfo || vehicle.lastServiceDate || "");

    setVehicleMasterSelected(vehicle);
    setWarrantyHint(hints.recommendedService || null);

    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setPendingVehicleToUse(null);
    setShowOverwriteConfirmation(false);
  };

  const handleUseVehicleClick = (vehicle: VehicleMasterRecord) => {
    const isFormFilled = 
      clientNom.trim() !== "" ||
      clientTelephone.trim() !== "" ||
      vehiculeModele.trim() !== "" ||
      vehiculeVIN.trim() !== "" ||
      vehiculeImmatriculation.trim() !== "" ||
      vehiculeVersion.trim() !== "" ||
      vehiculeDateLivraison.trim() !== "" ||
      vehiculeDateMiseCirculation.trim() !== "" ||
      vehiculeDernierEntretien.trim() !== "";

    if (isFormFilled) {
      setPendingVehicleToUse(vehicle);
      setShowOverwriteConfirmation(true);
    } else {
      handleUseVehicleMasterRecord(vehicle);
    }
  };

  const isActiveDossier = (dossier: DossierSAV): boolean => {
    const activeStatuses = [
      DossierStatus.NOUVEAU,
      DossierStatus.EN_ATTENTE_RECEPTION,
      DossierStatus.VEHICULE_RECU,
      DossierStatus.EN_ATTENTE_ACCORD,
      DossierStatus.TRAVAUX_PLANIFIES,
      DossierStatus.EN_TRAVAUX,
      DossierStatus.BLOQUE,
      DossierStatus.CONTROLE_QUALITE,
      DossierStatus.PRET_A_LIVRER,
      DossierStatus.PRET_FACTURATION,
      DossierStatus.LIVRE
    ];
    return activeStatuses.includes(dossier.statut);
  };

  const handleImmatriculationBlur = () => {
    const rawVal = vehiculeImmatriculation.trim();
    if (!rawVal) return;

    // Normaliser la plaque dans l'input
    const normalizedPlate = rawVal.toUpperCase().replace(/\s+/g, " ").trim();
    setVehiculeImmatriculation(normalizedPlate);

    // Rechercher dans vehicleMasterRecords par plaque normalisée (sans espaces pour la comparaison stricte)
    const cleanPlateForSearch = normalizedPlate.replace(/\s+/g, "");
    const matches = vehicleMasterRecords.filter(r => {
      if (!r.plateNumber) return false;
      const cleanRecordPlate = r.plateNumber.toUpperCase().replace(/\s+/g, "");
      return cleanRecordPlate === cleanPlateForSearch;
    });

    if (matches.length === 1) {
      const matchedVehicle = matches[0];
      const isFormFilled = 
        clientNom.trim() !== "" ||
        clientTelephone.trim() !== "" ||
        vehiculeModele.trim() !== "" ||
        vehiculeVIN.trim() !== "" ||
        vehiculeVersion.trim() !== "" ||
        vehiculeDateLivraison.trim() !== "" ||
        vehiculeDateMiseCirculation.trim() !== "" ||
        vehiculeDernierEntretien.trim() !== "";

      if (isFormFilled) {
        setPendingVehicleToUse(matchedVehicle);
        setShowOverwriteConfirmation(true);
      } else {
        handleUseVehicleMasterRecord(matchedVehicle);
      }
    } else if (matches.length > 1) {
      setPlateMultipleMatches(matches);
    }
  };
  
  // Local Form state
  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [deposantNom, setDeposantNom] = useState("");
  const [deposantTelephone, setDeposantTelephone] = useState("");
  const [deposantSame, setDeposantSame] = useState(true);

  const updateClientNom = (val: string) => {
    setClientNom(val);
    if (deposantSame) {
      setDeposantNom(val);
    }
  };

  const updateClientTelephone = (val: string) => {
    setClientTelephone(val);
    if (deposantSame) {
      setDeposantTelephone(val);
    }
  };

  const updateDeposantNom = (val: string) => {
    setDeposantNom(val);
    if (val !== clientNom) {
      setDeposantSame(false);
    }
  };

  const updateDeposantTelephone = (val: string) => {
    setDeposantTelephone(val);
    if (val !== clientTelephone) {
      setDeposantSame(false);
    }
  };
  
  const [vehiculeMarque, setVehiculeMarque] = useState("Dongfeng"); // Dongfeng, DFSK, Forthing
  const [vehiculeModele, setVehiculeModele] = useState("");
  const [vehiculeImmatriculation, setVehiculeImmatriculation] = useState("");
  const [vehiculeVIN, setVehiculeVIN] = useState("");
  const [vehiculeKilometrage, setVehiculeKilometrage] = useState<number>(15000);
  const [vehiculeCouleur, setVehiculeCouleur] = useState("");
  const [vehiculeVersion, setVehiculeVersion] = useState("");
  const [vehiculeDateLivraison, setVehiculeDateLivraison] = useState("");
  const [vehiculeDateMiseCirculation, setVehiculeDateMiseCirculation] = useState("");
  const [vehiculeStatutGarantie, setVehiculeStatutGarantie] = useState("Garantie inconnue");
  const [vehiculeDernierEntretien, setVehiculeDernierEntretien] = useState("");
  const [vehicleMasterSelected, setVehicleMasterSelected] = useState<VehicleMasterRecord | null>(null);
  const [warrantyHint, setWarrantyHint] = useState<string | null>(null);
  
  const [typeDossier, setTypeDossier] = useState<InterventionType>(InterventionType.ENTRETIEN_RAPIDE);
  const [priorite, setPriorite] = useState<DossierPriority>(DossierPriority.NORMALE);
  const [plainteClient, setPlainteClient] = useState("");
  const [observationsReception, setObservationsReception] = useState("");
  const [niveauCarburant, setNiveauCarburant] = useState<number>(50);
  
  // Damage checks
  const [rayures, setRayures] = useState(false);
  const [bosses, setBosses] = useState(false);
  const [fissureParbrise, setFissureParbrise] = useState(false);
  const [jantesAbimees, setJantesAbimees] = useState(false);
  const [autresNotes, setAutresNotes] = useState("");
  
  // Handover objects
  const [objets, setObjets] = useState<string[]>(["Gilet jaune & triangle"]);
  const [tempObjet, setTempObjet] = useState("");

  const [photosPre, setPhotosPre] = useState<CameraPhoto[]>([]);
  const [photoTitle, setPhotoTitle] = useState("");
  const [photoCategory, setPhotoCategory] = useState<PhotoCategory>("réception avant");

  const handleAddObject = () => {
    if (tempObjet.trim()) {
      setObjets([...objets, tempObjet.trim()]);
      setTempObjet("");
    }
  };

  const handleRemoveObject = (index: number) => {
    setObjets(objets.filter((_, i) => i !== index));
  };

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      const currentCount = photosPre.length;
      const nextPhotos = await Promise.all(Array.from(files).map((file, index) => (
        fileToCameraPhoto(file, {
          title: photoTitle.trim() || `${photoCategory} ${currentCount + index + 1}`,
          category: photoCategory,
          takenBy: "Conseiller Client NIMR",
        })
      )));
      setPhotosPre(prev => [...prev, ...nextPhotos]);
      setPhotoTitle("");
    } catch {
      console.error("Impossible d'ajouter cette photo. Veuillez réessayer avec une image valide.");
    }
  };

  const handleFormSubmit = () => {
    const newDossier = createReceptionDossier({
      clientNom,
      clientTelephone,
      deposantNom,
      deposantTelephone,
      vehiculeMarque,
      vehiculeModele,
      vehiculeImmatriculation,
      vehiculeVIN,
      vehiculeKilometrage: Number(vehiculeKilometrage),
      vehiculeCouleur,
      typeDossier,
      priorite,
      plainteClient,
      observationsReception,
      photosAvant: photosPre,
      niveauCarburant,
      etatCarrosserie: {
        rayures,
        bosses,
        fissureParbrise,
        jantesAbimees,
        autresNotes
      },
      objetsLaisses: objets,
      vehiculeVersion,
      dateLivraison: vehiculeDateLivraison,
      dateMiseCirculation: vehiculeDateMiseCirculation,
      statutGarantie: vehiculeStatutGarantie,
      dernierEntretien: vehiculeDernierEntretien
    }, existingDossierIds);

    onAddDossier(newDossier);
    setCurrentStep(5); // Show success screen
  };

  const stepsList = [
    { num: 1, label: "Client", icon: Users },
    { num: 2, label: "Véhicule", icon: Car },
    { num: 3, label: "Motif", icon: FileText },
    { num: 4, label: "État & Photos", icon: Camera },
    { num: 5, label: "Succès", icon: ClipboardCheck }
  ];

  return (
    <div data-testid="reception-start" className="bg-white  border border-slate-200  rounded-lg shadow-sm overflow-hidden max-w-4xl mx-auto">
      {/* Title block */}
      <div className="p-6 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
        <div>
          <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2 font-display uppercase">
            <Sparkles className="w-4.5 h-4.5 text-blue-400" />
            RÉCEPTION AUTOMOBILE DIGITALE SUR TABLETTE
          </h2>
          <p className="text-slate-400 text-xs font-medium">Parcours guidé et rapide pour l'accueil client NIMR</p>
        </div>
        <span className="text-xs bg-slate-800 text-slate-300 font-bold px-3 py-1 rounded-md border border-slate-700/60 font-mono">
          Étape {currentStep < 5 ? `${currentStep} / 4` : "Terminé"}
        </span>
      </div>

      {receptionError && (
        <div data-testid="reception-error-message" className="mx-6 mt-4 p-3 bg-red-50 text-red-700   border border-red-200 rounded-lg text-xs font-bold">
          {receptionError}
        </div>
      )}

      {/* Steps progress indicator */}
      <div className="bg-slate-50  border-b border-slate-200  px-6 py-4 flex justify-between items-center overflow-x-auto gap-4">
        {stepsList.map(step => {
          const StepIcon = step.icon;
          const isActive = currentStep === step.num;
          const isCompleted = currentStep > step.num;
          
          return (
            <div key={step.num} className="flex items-center gap-2 flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition duration-200 ${
                isActive 
                  ? "bg-blue-600 text-white ring-4 ring-blue-100 " 
                  : isCompleted 
                    ? "bg-green-600 text-white" 
                    : "bg-slate-200  text-slate-500 "
              }`}>
                {isCompleted ? <Check className="w-4 h-4" /> : step.num}
              </div>
              <span className={`text-xs font-semibold ${isActive ? "text-blue-600  font-bold font-display" : "text-slate-500 "}`}>
                {step.label}
              </span>
              {step.num < 5 && <span className="text-slate-300 ">→</span>}
            </div>
          );
        })}
      </div>

      {/* Collapsible Panel: Base véhicules NIMR */}
      {canSearchVehicleMaster(currentUserRole) && (
        <div className="mx-6 mt-4 border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            data-testid="vehicle-master-panel-toggle"
            onClick={() => setVehicleMasterPanelOpen(!vehicleMasterPanelOpen)}
            className="w-full px-4 py-3 bg-slate-50 flex justify-between items-center text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-600" />
              Base véhicules NIMR ({vehicleMasterRecords.length} véhicule(s) en local)
            </span>
            <span>{vehicleMasterPanelOpen ? "▲ Masquer" : "▼ Gérer / Consulter"}</span>
          </button>

          {vehicleMasterPanelOpen && (
            <div className="p-4 bg-white space-y-4 border-t border-slate-100 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 font-semibold">Dernier import : <span className="text-slate-800 font-bold">{vehicleMasterLastImport ? new Date(vehicleMasterLastImport).toLocaleString("fr-FR") : "Aucun"}</span></p>
                  <p className="text-slate-400 text-[10px] mt-1">
                    Base locale importée par l’utilisateur. Ne pas partager/exporter sans autorisation.
                  </p>
                </div>

                {canManageVehicleMaster(currentUserRole) && (
                  <div className="flex flex-col gap-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Importer un fichier véhicules (CSV) :</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".csv"
                        data-testid="vehicle-master-import-input"
                        onChange={handleImportCsvFile}
                        className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {vehicleMasterRecords.length > 0 && (
                        <button
                          type="button"
                          data-testid="vehicle-master-clear-btn"
                          onClick={() => setShowClearConfirmation(true)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md font-bold transition active:scale-95 cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Vider la base
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {importResult && (
                <div data-testid="vehicle-master-import-result" className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 animate-fade-in">
                  <h4 className="font-bold text-slate-800">Résultat du dernier import :</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-semibold text-slate-600">
                    <div>Véhicules importés : <strong className="text-emerald-600">{importResult.importedCount}</strong></div>
                    <div>Lignes ignorées : <strong className="text-amber-600">{importResult.ignoredCount}</strong></div>
                    <div>Doublons VIN : <strong className="text-red-600">{importResult.duplicateVinCount}</strong></div>
                    <div>Doublons Immatriculation : <strong className="text-red-600">{importResult.duplicatePlateCount}</strong></div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="text-red-600 font-bold text-[10px] mt-2 space-y-0.5">
                      <p>Erreurs détectées :</p>
                      <ul className="list-disc list-inside">
                        {importResult.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importResult.warnings.length > 0 && (
                    <div className="text-amber-600 font-bold text-[10px] mt-1 space-y-0.5">
                      <p>Avertissements :</p>
                      <ul className="list-disc list-inside">
                        {importResult.warnings.map((warn, idx) => (
                          <li key={idx}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main step content */}
      <div className="p-6 min-h-[380px]">
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in">
            {/* Zone : Recherche véhicule NIMR */}
            {canSearchVehicleMaster(currentUserRole) && (
              <div data-testid="workshop-vehicle-master-search-zone" className="p-4 bg-blue-50/35 border border-blue-100 rounded-xl space-y-3">
                <h4 className="font-bold text-blue-900 text-xs flex items-center gap-1.5 uppercase font-display">
                  <Search className="w-4 h-4 text-blue-600" />
                  Recherche véhicule NIMR
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    data-testid="vehicle-master-search-input"
                    value={searchQuery}
                    onChange={(e) => handleSearchVehicle(e.target.value)}
                    placeholder="Saisir VIN, Immatriculation, Client ou Modèle..."
                    className="flex-1 p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => handleSearchVehicle("")}
                      className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                {hasSearched && searchResults.length === 0 && (
                  <div data-testid="vehicle-master-not-found-alert" className="p-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-600" />
                    Véhicule non trouvé dans la base locale. Continuer en saisie manuelle.
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="max-h-60 overflow-y-auto space-y-2 pt-1">
                    {searchResults.map(vehicle => {
                      const hints = getVehicleReceptionHints(vehicle, new Date());
                      const isWarrantyActive = hints.warrantyStatus === "Garantie active";
                      const isWarrantyExpired = hints.warrantyStatus === "Garantie expirée";
                      const badgeColor = isWarrantyActive
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : isWarrantyExpired
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : "bg-slate-100 text-slate-800 border border-slate-200";

                      return (
                        <div
                          key={vehicle.id}
                          data-testid={`vehicle-result-row-${vehicle.id}`}
                          className="p-3 bg-white border border-slate-150 rounded-lg hover:border-blue-200 hover:shadow-xs transition flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-slate-800" data-testid={`vehicle-result-vin-${vehicle.id}`}>{vehicle.vin || "PAS DE VIN"}</span>
                              {vehicle.plateNumber && (
                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono font-black text-slate-700">{vehicle.plateNumber}</span>
                              )}
                            </div>
                            <div className="font-semibold text-slate-600">
                              {vehicle.brand} {vehicle.model} {vehicle.version ? `· ${vehicle.version}` : ""}
                            </div>
                            <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                              <span>Client : <strong className="text-slate-700">{vehicle.customerName || "Inconnu"}</strong></span>
                              {canViewVehicleSensitiveFields(currentUserRole) && vehicle.customerPhone && (
                                <span>Tél : <strong className="text-slate-700 font-mono" data-testid={`vehicle-result-phone-${vehicle.id}`}>{vehicle.customerPhone}</strong></span>
                              )}
                            </div>
                            {hints.lastServiceInfo && (
                              <div className="text-[10px] text-blue-700 font-bold mt-1">
                                {hints.lastServiceInfo}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-row sm:flex-col items-end justify-between sm:justify-center gap-2">
                            <div className="space-y-1 text-right">
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase inline-block ${badgeColor}`}>
                                {hints.warrantyStatus}
                              </span>
                              {(vehicle.warrantyPartsEndDate || vehicle.warrantyLaborEndDate) && (
                                <div className="text-[9px] text-slate-400 font-medium leading-tight hidden sm:block">
                                  {vehicle.warrantyPartsEndDate && <div>Garantie pièces : {vehicle.warrantyPartsEndDate}</div>}
                                  {vehicle.warrantyLaborEndDate && <div>Garantie MO : {vehicle.warrantyLaborEndDate}</div>}
                                </div>
                              )}
                            </div>
                            {canUseVehicleForReception(currentUserRole) && (
                              <button
                                type="button"
                                data-testid={`vehicle-use-btn-${vehicle.id}`}
                                onClick={() => handleUseVehicleClick(vehicle)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-extrabold transition active:scale-95 cursor-pointer"
                              >
                                Utiliser ce véhicule
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <h3 className="font-bold text-slate-800  text-sm border-b pb-2">Informations Générales Client</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Nom du Client / Société *</label>
                <input 
                  type="text" 
                  data-testid="reception-client-name"
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 " 
                  placeholder="EX: Client Démo 001 ou Société Démo"
                  value={clientNom}
                  onChange={(e) => updateClientNom(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Téléphone Client *</label>
                <input 
                  type="text" 
                  data-testid="reception-client-phone"
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 " 
                  placeholder="+216 -- --- ---"
                  value={clientTelephone}
                  onChange={(e) => updateClientTelephone(e.target.value)}
                />
              </div>
            </div>

            {/* Presets Clients Fictifs */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Saisie rapide client (Presets) :</span>
              <div className="flex flex-wrap gap-2">
                {PRESET_CLIENTS.map((client, idx) => (
                  <button
                    key={idx}
                    type="button"
                    data-testid={`preset-client-${idx}`}
                    onClick={() => {
                      updateClientNom(client.nom);
                      updateClientTelephone(client.tel);
                    }}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100   text-blue-700  border border-blue-200  text-[10px] font-bold rounded-lg transition active:scale-95 cursor-pointer"
                  >
                    {client.nom}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50  rounded-lg space-y-4 border border-slate-200 ">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="deposantSame" 
                  data-testid="reception-deposant-same"
                  className="rounded text-blue-600 focus:ring-blue-500"
                  checked={deposantSame}
                  onChange={(e) => {
                    setDeposantSame(e.target.checked);
                    if (e.target.checked) {
                      setDeposantNom(clientNom);
                      setDeposantTelephone(clientTelephone);
                    }
                  }}
                />
                <label htmlFor="deposantSame" className="text-xs font-bold text-slate-700 ">Le déposant est le propriétaire du véhicule</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-500  mb-1">Nom du Déposant</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 bg-white  border border-slate-200  rounded-lg text-xs " 
                    placeholder="Nom du conducteur livreur"
                    value={deposantNom}
                    onChange={(e) => updateDeposantNom(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500  mb-1">Téléphone Déposant</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 bg-white  border border-slate-200  rounded-lg text-xs font-mono " 
                    placeholder="Téléphone du livreur"
                    value={deposantTelephone}
                    onChange={(e) => updateDeposantTelephone(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-bold text-slate-800  text-sm border-b pb-2">Spécifications Techniques Véhicule</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Marque Officielle *</label>
                <select 
                  data-testid="reception-vehicle-brand"
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs font-bold text-slate-700  focus:outline-none"
                  value={vehiculeMarque}
                  onChange={(e) => setVehiculeMarque(e.target.value)}
                >
                  <option value="Dongfeng">Dongfeng</option>
                  <option value="DFSK">DFSK</option>
                  <option value="Forthing">Forthing</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Modèle du Véhicule *</label>
                <input 
                  type="text" 
                  data-testid="reception-vehicle-model"
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs font-semibold focus:outline-none " 
                  placeholder="EX: T5 EVO, Glory 580, S50EV"
                  value={vehiculeModele}
                  onChange={(e) => setVehiculeModele(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Immatriculation Tunisienne *</label>
                <input 
                  type="text" 
                  data-testid="reception-plate"
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs font-mono font-bold placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 " 
                  placeholder="Ex: 000 TU 0001"
                  value={vehiculeImmatriculation}
                  onChange={(e) => setVehiculeImmatriculation(e.target.value)}
                  onBlur={handleImmatriculationBlur}
                />
              </div>
            </div>

            {/* Presets Modèles NIMR */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Saisie rapide modèle NIMR :</span>
              <div className="flex flex-wrap gap-2">
                {PRESET_MODELS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    data-testid={item.testId}
                    onClick={() => {
                      setVehiculeMarque(item.marque);
                      setVehiculeModele(item.modele);
                    }}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100   text-blue-700  border border-blue-200  text-[10px] font-bold rounded-lg transition active:scale-95 cursor-pointer"
                  >
                    {item.marque} {item.modele}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Code VIN (Châssis) *</label>
                <input 
                  type="text" 
                  data-testid="reception-vin"
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs font-mono focus:outline-none " 
                  placeholder="DEMOVIN000000001"
                  value={vehiculeVIN}
                  onChange={(e) => setVehiculeVIN(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Kilométrage Actuel *</label>
                <input 
                  type="number" 
                  data-testid="reception-mileage"
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs font-bold focus:outline-none " 
                  value={vehiculeKilometrage}
                  onChange={(e) => setVehiculeKilometrage(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Teinte Carrosserie (Couleur)</label>
                <input 
                  type="text" 
                  data-testid="reception-vehicle-color"
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs focus:outline-none " 
                  placeholder="Gris Magnétique, Rouge Rubis"
                  value={vehiculeCouleur}
                  onChange={(e) => setVehiculeCouleur(e.target.value)}
                />
                {/* Presets Couleurs */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["Blanc", "Noir", "Gris", "Bleu", "Rouge"].map((col, idx) => (
                    <button
                      key={idx}
                      type="button"
                      data-testid={`preset-color-${col.toLowerCase()}`}
                      onClick={() => setVehiculeCouleur(col)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700    text-[10px] font-bold rounded-md transition active:scale-95 cursor-pointer"
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Version du Véhicule</label>
                <input 
                  type="text" 
                  data-testid="reception-vehicle-version"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                  placeholder="EX: Luxury, Comfort, Premium"
                  value={vehiculeVersion}
                  onChange={(e) => setVehiculeVersion(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Date de livraison</label>
                <input 
                  type="date" 
                  data-testid="reception-delivery-date"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none font-mono" 
                  value={vehiculeDateLivraison}
                  onChange={(e) => setVehiculeDateLivraison(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Date de mise en circulation</label>
                <input 
                  type="date" 
                  data-testid="reception-circulation-date"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none font-mono" 
                  value={vehiculeDateMiseCirculation}
                  onChange={(e) => setVehiculeDateMiseCirculation(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Statut Garantie</label>
                <div className="flex items-center gap-2">
                  <select 
                    data-testid="reception-warranty-status"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                    value={vehiculeStatutGarantie}
                    onChange={(e) => setVehiculeStatutGarantie(e.target.value)}
                  >
                    <option value="Garantie inconnue">Garantie inconnue</option>
                    <option value="Garantie active">Garantie active</option>
                    <option value="Garantie expirée">Garantie expirée</option>
                  </select>
                  <span 
                    data-testid="reception-warranty-badge"
                    className={`px-3 py-2.5 rounded-lg text-xs font-extrabold uppercase shrink-0 ${
                      vehiculeStatutGarantie === "Garantie active" 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                        : vehiculeStatutGarantie === "Garantie expirée"
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {vehiculeStatutGarantie}
                  </span>
                </div>
                {warrantyHint && (
                  <p className="text-[10px] text-amber-600 font-bold mt-1" data-testid="reception-warranty-hint">
                    {warrantyHint}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Dernier Entretien</label>
                <input 
                  type="text" 
                  data-testid="reception-last-service"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                  placeholder="EX: Dernier entretien le 2027-06-15 à 15000 km"
                  value={vehiculeDernierEntretien}
                  onChange={(e) => setVehiculeDernierEntretien(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-bold text-slate-800  text-sm border-b pb-2">Motif d'Entrée & Demande Client</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Type de Dossier SAV *</label>
                <select 
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs font-semibold text-slate-700  focus:outline-none"
                  value={typeDossier}
                  onChange={(e) => setTypeDossier(e.target.value as InterventionType)}
                >
                  {Object.values(InterventionType).map((val) => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Priorité Affectée *</label>
                <select 
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs font-semibold text-slate-700  focus:outline-none"
                  value={priorite}
                  onChange={(e) => setPriorite(e.target.value as DossierPriority)}
                >
                  {Object.values(DossierPriority).map((val) => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Plainte Principale du client (Symptômes ou travaux demandés) *</label>
                <textarea 
                  data-testid="reception-reason"
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-16 " 
                  placeholder="EX: Révision des 10000 km + bruit de sifflement d'embrayage lors des démarrages en côte..."
                  value={plainteClient}
                  onChange={(e) => setPlainteClient(e.target.value)}
                />
                {/* Presets Plaintes */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {PRESET_COMPLAINTS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      data-testid={item.testId}
                      onClick={() => {
                        const current = plainteClient.trim();
                        if (!current) {
                          setPlainteClient(item.text);
                        } else {
                          const delimiter = current.endsWith(",") || current.endsWith(".") ? " " : ", ";
                          setPlainteClient(current + delimiter + item.text);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100   text-blue-700  border border-blue-200  text-[10px] font-bold rounded-lg transition active:scale-95 cursor-pointer"
                    >
                      {item.text}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600  uppercase mb-1">Observations Réception / Conseils du Réceptionnaire</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-slate-50  border border-slate-200  rounded-lg text-xs focus:outline-none " 
                  placeholder="Vidéos à envoyer, niveau d'usure des pneus avants jugé important..."
                  value={observationsReception}
                  onChange={(e) => setObservationsReception(e.target.value)}
                />
              </div>
            </div>

            {/* Objets check list */}
            <div data-testid="reception-objects-left" className="p-4 bg-zinc-50  rounded-xl border border-zinc-200 ">
              <span className="text-xs font-bold text-zinc-600  uppercase block mb-2">Objets de valeur laissés dans le véhicule :</span>
              
              <div className="flex gap-2 mb-3">
                <input 
                  type="text" 
                  className="bg-white  border border-zinc-200  rounded px-2.5 py-1 text-xs flex-1  focus:outline-none" 
                  placeholder="Ex: Câble USB de chargeur, lunettes de marque..."
                  value={tempObjet}
                  onChange={(e) => setTempObjet(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddObject()}
                />
                <button 
                  onClick={handleAddObject}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              </div>

              {objets.length === 0 ? (
                <p className="text-[11px] text-zinc-400 italic">Aucun objet recensé à bord.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {objets.map((obj, i) => (
                    <span key={i} className="bg-blue-50  text-blue-700  border border-blue-200  text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      {obj}
                      <button onClick={() => handleRemoveObject(i)} className="hover:text-red-600 font-black cursor-pointer ml-1 text-xs">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-bold text-slate-800  text-sm border-b pb-2">Diagnostic Visuel & Prise de Photos</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Column - Damage switches */}
              <div data-testid="reception-body-condition" className="space-y-3 p-4 bg-zinc-50  rounded-xl border border-zinc-200 ">
                <span className="text-xs font-bold text-slate-700  uppercase block mb-1">État Carrosserie Rapide :</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-2 bg-white  border rounded cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={rayures} 
                      onChange={(e) => setRayures(e.target.checked)} 
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 ">Rayures</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white  border rounded cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={bosses} 
                      onChange={(e) => setBosses(e.target.checked)} 
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 ">Bosses</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white  border rounded cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={fissureParbrise} 
                      onChange={(e) => setFissureParbrise(e.target.checked)} 
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 ">Pare-brise fissuré</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white  border rounded cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={jantesAbimees} 
                      onChange={(e) => setJantesAbimees(e.target.checked)} 
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 ">Jantes abîmées</span>
                  </label>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-medium text-slate-500  mb-1">Autres précisions de carrosserie :</label>
                  <input 
                    type="text" 
                    className="w-full p-2 bg-white  border border-slate-200  rounded text-xs focus:outline-none " 
                    placeholder="Choc rétro gauche, peinture délavée sur capot..."
                    value={autresNotes}
                    onChange={(e) => setAutresNotes(e.target.value)}
                  />
                </div>

                {/* Fuel Slider */}
                <div className="pt-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700  mb-1">
                    <span>Niveau de Carburant / Batterie :</span>
                    <span data-testid="reception-fuel-value" className="text-blue-600 font-extrabold">{niveauCarburant === 5 ? "Réserve (5%)" : `${niveauCarburant}%`}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    data-testid="reception-fuel-level"
                    className="w-full accent-blue-600"
                    value={niveauCarburant} 
                    onChange={(e) => setNiveauCarburant(Number(e.target.value))} 
                  />
                  <div className="flex justify-between text-[10px] text-zinc-400 font-bold px-1 mb-2">
                    <span>VIDE</span>
                    <span>1/2</span>
                    <span>PLEIN</span>
                  </div>
                  {/* Presets Carburant */}
                  <div className="flex gap-1.5 mt-2 justify-between">
                    {[
                      { label: "Réserve", val: 5, testId: "preset-fuel-reserve" },
                      { label: "25%", val: 25, testId: "preset-fuel-25" },
                      { label: "50%", val: 50, testId: "preset-fuel-50" },
                      { label: "75%", val: 75, testId: "preset-fuel-75" },
                      { label: "100%", val: 100, testId: "preset-fuel-100" }
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        data-testid={item.testId}
                        onClick={() => setNiveauCarburant(item.val)}
                        className={`flex-1 py-1.5 text-[9px] font-black rounded-lg transition cursor-pointer active:scale-95 ${
                          niveauCarburant === item.val
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700   "
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Tablet camera */}
              <div className="p-4 bg-zinc-50  rounded-xl border border-zinc-200  space-y-3">
                <span className="text-xs font-bold text-slate-700  uppercase block mb-1">Appareil Photo Tablette :</span>
                
                <div className="grid grid-cols-1 gap-2">
                  <input 
                    type="text" 
                    className="bg-white  border border-zinc-200  rounded px-2.5 py-1 text-xs flex-1  focus:outline-none" 
                    placeholder="Titre de la photo (ex: Aile ARG, coffre...)"
                    value={photoTitle}
                    onChange={(e) => setPhotoTitle(e.target.value)}
                  />

                  <select
                    className="bg-white  border border-zinc-200  rounded px-2.5 py-1 text-xs font-bold  focus:outline-none"
                    value={photoCategory}
                    data-testid="reception-photo-category"
                    onChange={(e) => setPhotoCategory(e.target.value as PhotoCategory)}
                  >
                    {PHOTO_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="px-3 py-1.5 bg-zinc-800 text-white rounded text-xs font-bold hover:bg-zinc-950 flex items-center justify-center gap-1.5 transition cursor-pointer">
                      <Camera className="w-3.5 h-3.5" />
                      Prendre
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        data-testid="reception-photo-input"
                        className="hidden"
                        onChange={(e) => {
                          void handlePhotoFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>

                    <label className="px-3 py-1.5 bg-white  border border-zinc-200  text-slate-700  rounded text-xs font-bold hover:bg-zinc-50  flex items-center justify-center gap-1.5 transition cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      Importer
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        data-testid="reception-photo-input-import"
                        className="hidden"
                        onChange={(e) => {
                          void handlePhotoFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Photo list rendering */}
                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto">
                  {photosPre.map((p) => (
                    <div key={p.id} data-testid="reception-photo-preview" className="relative rounded bg-white  border-2 border-slate-100 overflow-hidden shadow-sm">
                      <img src={p.url} alt={p.title} className="w-full h-16 object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] p-1 font-bold truncate">
                        {p.title}
                      </div>
                      <div className="absolute left-1 top-1 bg-white/90 text-zinc-700 text-[8px] px-1.5 py-0.5 rounded font-bold">
                        {p.category}
                      </div>
                      <button 
                        onClick={() => setPhotosPre(photosPre.filter(ph => ph.id !== p.id))}
                        data-testid="reception-photo-delete"
                        className="absolute right-1 top-1 bg-red-600/80 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-700"
                        title="Supprimer la photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="text-center py-6 px-10 space-y-4 animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100  rounded-full text-green-600 ">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900 ">Dossier créé avec succès !</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Le dossier a été envoyé au chef d'atelier pour affectation immédiate et planification de technicien. Les informations sont également synchronisées localement.
              </p>
            </div>

            <div className="p-4 bg-slate-50  border border-slate-200  rounded-xl max-w-sm mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between font-bold">
                <span className="text-neutral-500">CLIENT :</span>
                <span className="text-neutral-800 ">{clientNom || "Client Démo 001"}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-neutral-500">VÉHICULE :</span>
                <span className="text-neutral-800 ">{vehiculeMarque} {vehiculeModele}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-neutral-500">IMMATRICULATION :</span>
                <LicencePlate plate={vehiculeImmatriculation || "000 TU 0001"} />
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-neutral-500">TYPE DOSSIER :</span>
                <span className="text-blue-600  font-bold uppercase">{typeDossier}</span>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button 
                onClick={() => {
                  // Reset states for a new dossier entry
                  setClientNom("");
                  setClientTelephone("");
                  setDeposantNom("");
                  setDeposantTelephone("");
                  setVehiculeModele("");
                  setVehiculeImmatriculation("");
                  setVehiculeVIN("");
                  setPlainteClient("");
                  setObservationsReception("");
                  setPhotosPre([]);
                  setPhotoCategory("réception avant");
                  setCurrentStep(1);
                }}
                data-testid="reception-new-btn"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800    rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Nouvelle Réception
              </button>

              <button 
                onClick={() => onNavigateToTab("dossiers-liste")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                Voir la Liste des dossiers
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation action buttons bottom */}
      {currentStep < 5 && (
        <div className="p-4 bg-slate-50  border-t border-slate-200  flex justify-between">
          <button
            onClick={() => {
              setReceptionError(null);
              setCurrentStep(prev => Math.max(1, prev - 1));
            }}
            disabled={currentStep === 1}
            data-testid="reception-previous"
            className={`px-4 py-2 bg-white  border border-slate-200  rounded-lg text-xs font-bold hover:bg-slate-100  text-slate-700  flex items-center gap-1.5 transition ${
              currentStep === 1 ? "opacity-40 cursor-not-allowed" : ""
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Retour
          </button>

          {currentStep < 4 ? (
            <button
               onClick={() => {
                // If required fields are omitted with placeholder checks
                if (currentStep === 1 && !clientNom) {
                  setReceptionError("Veuillez saisir le nom du client.");
                  return;
                }
                if (currentStep === 2 && (!vehiculeModele || !vehiculeImmatriculation)) {
                  setReceptionError("Veuillez remplir le modèle et l'immatriculation.");
                  return;
                }
                setReceptionError(null);
                setCurrentStep(prev => prev + 1);
              }}
              data-testid="reception-next"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition hover:scale-105 cursor-pointer"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                setReceptionError(null);
                const duplicate = dossiers.find(d => {
                  if (!isActiveDossier(d)) return false;
                  const matchVin = d.vehiculeVIN && vehiculeVIN && d.vehiculeVIN.toUpperCase().replace(/\s+/g, "") === vehiculeVIN.toUpperCase().replace(/\s+/g, "");
                  const matchImmat = d.vehiculeImmatriculation && vehiculeImmatriculation && d.vehiculeImmatriculation.toUpperCase().replace(/\s+/g, "") === vehiculeImmatriculation.toUpperCase().replace(/\s+/g, "");
                  return matchVin || matchImmat;
                });
                if (duplicate) {
                  setActiveDuplicateDossier(duplicate);
                } else {
                  handleFormSubmit();
                }
              }}
              data-testid="reception-submit"
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer hover:scale-105"
            >
              Créer & Finaliser le dossier
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Overwrite Confirmation Modal */}
      {showOverwriteConfirmation && pendingVehicleToUse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Champs déjà renseignés</h3>
                <p className="text-slate-500 text-xs mt-1">
                  Certains champs sont déjà renseignés. Remplacer par les données du véhicule sélectionné ?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                data-testid="vehicle-overwrite-cancel"
                onClick={() => {
                  setShowOverwriteConfirmation(false);
                  setPendingVehicleToUse(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="vehicle-overwrite-confirm"
                onClick={() => pendingVehicleToUse && handleUseVehicleMasterRecord(pendingVehicleToUse)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirmation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Vider la base locale ?</h3>
                <p className="text-slate-500 text-xs mt-1">
                  Confirmer la suppression de la base véhicules locale ?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                data-testid="vehicle-clear-cancel"
                onClick={() => setShowClearConfirmation(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="vehicle-clear-confirm"
                onClick={() => {
                  onClearVehicleMaster();
                  setImportResult(null);
                  setSearchResults([]);
                  setSearchQuery("");
                  setHasSearched(false);
                  setShowClearConfirmation(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiple Matches Modal */}
      {plateMultipleMatches.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">Plusieurs véhicules trouvés</h3>
              <p className="text-slate-500 text-xs mt-1">
                Plusieurs fiches de véhicules correspondent à cette immatriculation. Veuillez en choisir une :
              </p>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {plateMultipleMatches.map((vehicle, idx) => (
                <div 
                  key={idx}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between text-xs transition"
                >
                  <div>
                    <div className="font-bold text-slate-800">{vehicle.brand} {vehicle.model} {vehicle.version}</div>
                    <div className="text-slate-500 text-[10px]">VIN: {vehicle.vin} | Client: {vehicle.customerName}</div>
                  </div>
                  <button
                    type="button"
                    data-testid={`select-matching-vehicle-${idx}`}
                    onClick={() => {
                      handleUseVehicleClick(vehicle);
                      setPlateMultipleMatches([]);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition cursor-pointer"
                  >
                    Choisir
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end text-xs pt-2">
              <button
                type="button"
                data-testid="close-multiple-matches"
                onClick={() => setPlateMultipleMatches([])}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Continuer manuellement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Active Dossier Guard Modal */}
      {activeDuplicateDossier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Dossier en cours</h3>
                <p className="text-slate-500 text-xs mt-1" data-testid="duplicate-warning-message">
                  Un dossier est déjà en cours pour ce véhicule.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                data-testid="duplicate-close"
                onClick={() => setActiveDuplicateDossier(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
              >
                Fermer
              </button>
              {onSelectDossier && (
                <button
                  type="button"
                  data-testid="open-existing-dossier"
                  onClick={() => {
                    onSelectDossier(activeDuplicateDossier.id);
                    setActiveDuplicateDossier(null);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition cursor-pointer"
                >
                  Ouvrir le dossier existant
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
