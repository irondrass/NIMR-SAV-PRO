import React, { useState } from "react";
import {
  User,
  TechnicienResource,
  WorkshopBay,
  WorkshopReservation,
  DossierSAV,
  UserRole,
  AtelierMetier,
  MaterialCategory,
  AtelierZone
} from "../types";
import {
  canManageResourceRepository,
  detectResourceRepositoryIssues,
  isWorkshopBay,
  normalizeWorkshopBay,
  normalizeTechnicienResource
} from "../sav-core";
import { createUser } from "../auth";
import {
  FolderTree,
  Users as UsersIcon,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Edit,
  Trash2,
  X,
  UserCheck
} from "lucide-react";

interface ResourceRepositoryViewProps {
  activeRole: UserRole;
  users: User[];
  persistUsers: (users: User[]) => void;
  techList: TechnicienResource[];
  setTechList: (techs: TechnicienResource[]) => void;
  baysList: WorkshopBay[];
  setBaysList: (bays: WorkshopBay[]) => void;
  reservations: WorkshopReservation[];
  dossiers: DossierSAV[];
}

export default function ResourceRepositoryView({
  activeRole,
  users,
  persistUsers,
  techList,
  setTechList,
  baysList,
  setBaysList,
  reservations,
  dossiers
}: ResourceRepositoryViewProps) {
  const [activeTab, setActiveTab] = useState<"users" | "companions" | "materials" | "diagnostic">("users");

  // User management states
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.LECTURE_SEULE);
  const [pin, setPin] = useState("");
  const [linkedHumanId, setLinkedHumanId] = useState("");

  // Companion management states
  const [editingCompanion, setEditingCompanion] = useState<TechnicienResource | null>(null);
  const [showAddCompanionModal, setShowAddCompanionModal] = useState(false);
  const [compNom, setCompNom] = useState("");
  const [compSpecialite, setCompSpecialite] = useState("");
  const [compMetierPrincipal, setCompMetierPrincipal] = useState<AtelierMetier>(AtelierMetier.MECANIQUE_RAPIDE);
  const [compMetiersSecondaires, setCompMetiersSecondaires] = useState<AtelierMetier[]>([]);
  const [compPlanifiable, setCompPlanifiable] = useState(true);
  const [compActif, setCompActif] = useState(true);
  const [compLinkedUserId, setCompLinkedUserId] = useState("");

  // Material resource states
  const [editingMaterial, setEditingMaterial] = useState<WorkshopBay | null>(null);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [bayId, setBayId] = useState("");
  const [bayName, setBayName] = useState("");
  const [bayCategorie, setBayCategorie] = useState<MaterialCategory>(MaterialCategory.PONT_SERVICE_RAPIDE);
  const [bayActif, setBayActif] = useState(true);
  const [bayPlanifiable, setBayPlanifiable] = useState(true);
  const [bayCapacite, setBayCapacite] = useState(1);
  const [bayCompatibleTasks, setBayCompatibleTasks] = useState<string>("");
  const [bayLocalisation, setBayLocalisation] = useState("Atelier NIMR");

  const [pendingAction, setPendingAction] = useState<{
    type: "delete-companion" | "delete-material";
    id: string;
    label: string;
    message: string;
  } | null>(null);

  // General error/success states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Compute diagnostics
  const issues = detectResourceRepositoryIssues(users, techList, baysList, reservations, dossiers);

  const resetUserForm = () => {
    setUsername("");
    setDisplayName("");
    setRole(UserRole.LECTURE_SEULE);
    setPin("");
    setLinkedHumanId("");
    setEditingUser(null);
    setErrorMsg(null);
  };

  const resetCompanionForm = () => {
    setCompNom("");
    setCompSpecialite("");
    setCompMetierPrincipal(AtelierMetier.MECANIQUE_RAPIDE);
    setCompMetiersSecondaires([]);
    setCompPlanifiable(true);
    setCompActif(true);
    setCompLinkedUserId("");
    setEditingCompanion(null);
    setErrorMsg(null);
  };

  const resetMaterialForm = () => {
    setBayId("");
    setBayName("");
    setBayCategorie(MaterialCategory.PONT_SERVICE_RAPIDE);
    setBayActif(true);
    setBayPlanifiable(true);
    setBayCapacite(1);
    setBayCompatibleTasks("");
    setBayLocalisation("Atelier NIMR");
    setEditingMaterial(null);
    setErrorMsg(null);
  };

  // Mutators for Users
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageResourceRepository(activeRole, "users")) {
      setErrorMsg("Accès refusé.");
      return;
    }
    if (!username.trim() || !displayName.trim()) {
      setErrorMsg("Identifiant et nom obligatoires.");
      return;
    }

    if (editingUser) {
      // Edit mode
      const updated = users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            displayName,
            role,
            linkedHumanResourceId: linkedHumanId || undefined
          };
        }
        return u;
      });
      persistUsers(updated);
      setSuccessMsg("Utilisateur mis à jour.");
      setEditingUser(null);
    } else {
      // Create mode
      if (!pin.trim()) {
        setErrorMsg("Code PIN obligatoire.");
        return;
      }
      if (users.some(u => u.username === username.trim().toLowerCase())) {
        setErrorMsg("Cet identifiant existe déjà.");
        return;
      }
      try {
        const newUser = await createUser(
          {
            username: username.trim().toLowerCase(),
            displayName: displayName.trim(),
            role,
            pin: pin.trim()
          },
          users
        );
        newUser.linkedHumanResourceId = linkedHumanId || undefined;
        persistUsers([...users, newUser]);
        setSuccessMsg("Utilisateur créé.");
        setShowAddUserModal(false);
      } catch (err) {
        setErrorMsg("Erreur lors de la création de l'utilisateur.");
      }
    }
    resetUserForm();
  };

  // Mutators for Companions
  const handleSaveCompanion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageResourceRepository(activeRole, "humans")) {
      setErrorMsg("Accès refusé.");
      return;
    }
    if (!compNom.trim() || !compSpecialite.trim()) {
      setErrorMsg("Nom et spécialité obligatoires.");
      return;
    }

    if (editingCompanion) {
      // Edit mode
      const updated = techList.map(t => {
        if (t.id === editingCompanion.id) {
          return normalizeTechnicienResource({
            ...t,
            nom: compNom.trim(),
            specialite: compSpecialite.trim(),
            metierPrincipal: compMetierPrincipal,
            metiersSecondaires: compMetiersSecondaires,
            planifiable: compPlanifiable,
            actif: compActif,
            linkedUserId: compLinkedUserId || undefined
          });
        }
        return t;
      });
      setTechList(updated);
      setSuccessMsg("Compagnon mis à jour.");
      setEditingCompanion(null);
    } else {
      // Create mode
      const newTech: TechnicienResource = normalizeTechnicienResource({
        id: "tech_" + Date.now(),
        nom: compNom.trim(),
        specialite: compSpecialite.trim(),
        disponibilite: "disponible",
        compétences: [compSpecialite.trim()],
        zoneAffectee: compMetierPrincipal === AtelierMetier.PEINTURE || compMetierPrincipal === AtelierMetier.PREPARATION_PEINTURE
          ? AtelierZone.PEINTURE
          : compMetierPrincipal === AtelierMetier.TOLERIE
          ? AtelierZone.CARROSSERIE
          : AtelierZone.GRANDS_TRAVAUX,
        absencesConges: [],
        capaciteJournaliere: 8,
        chargeActuelle: 0,
        metierPrincipal: compMetierPrincipal,
        metiersSecondaires: compMetiersSecondaires,
        planifiable: compPlanifiable,
        actif: compActif,
        linkedUserId: compLinkedUserId || undefined
      });
      setTechList([...techList, newTech]);
      setSuccessMsg("Compagnon créé.");
      setShowAddCompanionModal(false);
    }
    resetCompanionForm();
  };

  // Mutators for Material resources
  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageResourceRepository(activeRole, "materials")) {
      setErrorMsg("Accès refusé.");
      return;
    }
    if (!bayName.trim()) {
      setErrorMsg("Nom de ressource obligatoire.");
      return;
    }

    const compTasks = bayCompatibleTasks.split(",").map(s => s.trim()).filter(Boolean);

    if (editingMaterial) {
      // Edit mode
      const updated = baysList.map(b => {
        if (b.id === editingMaterial.id) {
          return normalizeWorkshopBay({
            ...b,
            name: bayName.trim(),
            nom: bayName.trim(),
            categorie: bayCategorie,
            actif: bayActif,
            planifiable: bayPlanifiable,
            capaciteVehicules: bayCapacite,
            compatibleTaskTypes: compTasks,
            localisation: bayLocalisation
          });
        }
        return b;
      });
      setBaysList(updated);
      setSuccessMsg("Ressource matérielle mise à jour.");
      setEditingMaterial(null);
    } else {
      // Create mode
      const newBayId = bayId.trim() || "bay_" + Date.now();
      if (baysList.some(b => b.id === newBayId)) {
        setErrorMsg("Identifiant déjà utilisé.");
        return;
      }
      const newBay: WorkshopBay = normalizeWorkshopBay({
        id: newBayId,
        name: bayName.trim(),
        nom: bayName.trim(),
        zone: bayCategorie === MaterialCategory.CABINE_PEINTURE ? AtelierZone.PEINTURE : AtelierZone.GRANDS_TRAVAUX,
        categorie: bayCategorie,
        actif: bayActif,
        planifiable: bayPlanifiable,
        capaciteVehicules: bayCapacite,
        compatibleTaskTypes: compTasks,
        localisation: bayLocalisation
      });
      setBaysList([...baysList, newBay]);
      setSuccessMsg("Ressource matérielle créée.");
      setShowAddMaterialModal(false);
    }
    resetMaterialForm();
  };

  const handleDeleteCompanion = (id: string) => {
    if (!canManageResourceRepository(activeRole, "humans")) return;
    const companion = techList.find(t => t.id === id);
    setPendingAction({
      type: "delete-companion",
      id,
      label: companion?.nom || id,
      message: `Confirmer la désactivation de ce compagnon ? Cette action ne supprime pas l’historique, mais la ressource ne sera plus proposée au planning.`
    });
  };

  const handleDeleteMaterial = (id: string) => {
    if (!canManageResourceRepository(activeRole, "materials")) return;
    const material = baysList.find(b => b.id === id);
    setPendingAction({
      type: "delete-material",
      id,
      label: material?.name || material?.nom || id,
      message: `Confirmer la désactivation de cette ressource matérielle ? Cette action ne supprime pas l’historique, mais la ressource ne sera plus proposée au planning.`
    });
  };

  const executePendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "delete-companion") {
      setTechList(techList.filter(t => t.id !== pendingAction.id));
      setSuccessMsg("Compagnon supprimé.");
    } else if (pendingAction.type === "delete-material") {
      setBaysList(baysList.filter(b => b.id !== pendingAction.id));
      setSuccessMsg("Ressource matérielle supprimée.");
    }
    setPendingAction(null);
  };

  const cancelPendingAction = () => {
    setPendingAction(null);
  };

  const toggleSecondaryMetier = (m: AtelierMetier) => {
    if (compMetiersSecondaires.includes(m)) {
      setCompMetiersSecondaires(compMetiersSecondaires.filter(x => x !== m));
    } else {
      setCompMetiersSecondaires([...compMetiersSecondaires, m]);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-6">
      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderTree className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Référentiel Ressources Atelier</h1>
            <p className="text-sm text-slate-500">
              Gérez les comptes, compagnons, équipements et diagnostiquez les anomalies de configuration.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full capitalize">
            Rôle : {activeRole.replace("_", " ")}
          </span>
          {issues.length > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {issues.length} Alerte(s)
            </span>
          )}
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="p-4 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 mb-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 bg-white rounded-t-lg shadow-sm overflow-hidden">
        <button
          data-testid="tab-users"
          onClick={() => { setActiveTab("users"); setErrorMsg(null); }}
          className={`flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === "users"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/20"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Utilisateurs réels
        </button>
        <button
          data-testid="tab-companions"
          onClick={() => { setActiveTab("companions"); setErrorMsg(null); }}
          className={`flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === "companions"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/20"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <UsersIcon className="h-4 w-4" />
          Ressources Humaines (Compagnons)
        </button>
        <button
          data-testid="tab-materials"
          onClick={() => { setActiveTab("materials"); setErrorMsg(null); }}
          className={`flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === "materials"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/20"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Wrench className="h-4 w-4" />
          Ressources Matérielles (Ponts/Zones)
        </button>
        <button
          data-testid="tab-diagnostic"
          onClick={() => { setActiveTab("diagnostic"); setErrorMsg(null); }}
          className={`flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === "diagnostic"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/20"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Diagnostic Référentiel
          {issues.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full font-bold">
              {issues.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        {/* TAB 1: USERS */}
        {activeTab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Comptes Utilisateurs Réels</h2>
              {canManageResourceRepository(activeRole, "users") && (
                <button
                  data-testid="btn-add-user"
                  onClick={() => { resetUserForm(); setShowAddUserModal(true); }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                >
                  <Plus className="h-4 w-4" /> Ajouter un utilisateur
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table data-testid="table-users" className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Identifiant</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nom Complet</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Rôle</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Ressource liée</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                    {canManageResourceRepository(activeRole, "users") && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {users.map(u => (
                    <tr key={u.id} data-testid={`row-user-${u.id}`}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">{u.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">{u.displayName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-800">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                        {techList.find(t => t.id === u.linkedHumanResourceId || t.linkedUserId === u.id)?.nom || (
                          <span className="text-slate-400 italic">Aucune</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                        }`}>
                          {u.active ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      {canManageResourceRepository(activeRole, "users") && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setUsername(u.username);
                              setDisplayName(u.displayName);
                              setRole(u.role);
                              setLinkedHumanId(u.linkedHumanResourceId || "");
                              setErrorMsg(null);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            Modifier
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Editing user panel */}
            {editingUser && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="font-bold text-slate-800 mb-4">Modifier l'utilisateur {editingUser.username}</h3>
                <form data-testid="form-user" onSubmit={handleSaveUser} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom d'affichage</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    >
                      {Object.values(UserRole).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Compagnon lié</label>
                    <select
                      value={linkedHumanId}
                      onChange={(e) => setLinkedHumanId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    >
                      <option value="">Aucun compagnon lié</option>
                      {techList.map(t => (
                        <option key={t.id} value={t.id}>{t.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      data-testid="btn-save-user"
                      className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Add user modal */}
            {showAddUserModal && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 text-lg">Créer un nouvel utilisateur</h3>
                    <button onClick={() => setShowAddUserModal(false)}>
                      <X className="h-5 w-5 text-slate-500" />
                    </button>
                  </div>
                  <form data-testid="form-user" onSubmit={handleSaveUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Identifiant unique (Login)</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ex: j.dupont"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Jean Dupont"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Code PIN de connexion</label>
                      <input
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="Code numérique"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      >
                        {Object.values(UserRole).map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Compagnon lié</label>
                      <select
                        value={linkedHumanId}
                        onChange={(e) => setLinkedHumanId(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      >
                        <option value="">Aucun compagnon lié</option>
                        {techList.map(t => (
                          <option key={t.id} value={t.id}>{t.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAddUserModal(false)}
                        className="bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        data-testid="btn-save-user"
                        className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COMPANIONS */}
        {activeTab === "companions" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Gestion des Compagnons (Ressources Humaines)</h2>
              {canManageResourceRepository(activeRole, "humans") && (
                <button
                  data-testid="btn-add-companion"
                  onClick={() => { resetCompanionForm(); setShowAddCompanionModal(true); }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                >
                  <Plus className="h-4 w-4" /> Ajouter un compagnon
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table data-testid="table-companions" className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Spécialité</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Métier Principal</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Métiers Secondaires</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Planifiable</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Compte Lié</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                    {canManageResourceRepository(activeRole, "humans") && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {techList.map(c => (
                    <tr key={c.id} data-testid={`row-companion-${c.id}`}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">{c.nom}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">{c.specialite}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-indigo-700 font-semibold">{c.metierPrincipal || "Non défini"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">
                        {c.metiersSecondaires && c.metiersSecondaires.length > 0
                          ? c.metiersSecondaires.join(", ")
                          : "Aucun"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {c.planifiable !== false ? "Oui" : "Non"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {users.find(u => u.id === c.linkedUserId || u.linkedHumanResourceId === c.id)?.username || (
                          <span className="text-slate-400 italic">Aucun</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.actif !== false ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {c.actif !== false ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      {canManageResourceRepository(activeRole, "humans") && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => {
                              setEditingCompanion(c);
                              setCompNom(c.nom);
                              setCompSpecialite(c.specialite);
                              setCompMetierPrincipal(c.metierPrincipal || AtelierMetier.MECANIQUE_RAPIDE);
                              setCompMetiersSecondaires(c.metiersSecondaires || []);
                              setCompPlanifiable(c.planifiable !== false);
                              setCompActif(c.actif !== false);
                              setCompLinkedUserId(c.linkedUserId || "");
                              setErrorMsg(null);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteCompanion(c.id)}
                            className="text-rose-600 hover:text-rose-900"
                          >
                            Supprimer
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Editing companion panel */}
            {editingCompanion && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="font-bold text-slate-800 mb-4">Modifier le compagnon {editingCompanion.nom}</h3>
                <form data-testid="form-companion" onSubmit={handleSaveCompanion} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom du compagnon</label>
                    <input
                      type="text"
                      value={compNom}
                      onChange={(e) => setCompNom(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Spécialité / Label</label>
                    <input
                      type="text"
                      value={compSpecialite}
                      onChange={(e) => setCompSpecialite(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Métier Principal</label>
                    <select
                      value={compMetierPrincipal}
                      onChange={(e) => setCompMetierPrincipal(e.target.value as AtelierMetier)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    >
                      {Object.values(AtelierMetier).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Métiers Secondaires</label>
                    <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs">
                      {Object.values(AtelierMetier).map(m => (
                        <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={compMetiersSecondaires.includes(m)}
                            onChange={() => toggleSecondaryMetier(m)}
                          />
                          <span>{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compPlanifiable}
                        onChange={(e) => setCompPlanifiable(e.target.checked)}
                      />
                      <span>Planifiable</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compActif}
                        onChange={(e) => setCompActif(e.target.checked)}
                      />
                      <span>Ressource Active</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Utilisateur lié</label>
                    <select
                      value={compLinkedUserId}
                      onChange={(e) => setCompLinkedUserId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    >
                      <option value="">Aucun compte lié</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.username} ({u.displayName})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      data-testid="btn-save-companion"
                      className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCompanion(null)}
                      className="bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Add companion modal */}
            {showAddCompanionModal && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 text-lg">Ajouter un compagnon</h3>
                    <button onClick={() => setShowAddCompanionModal(false)}>
                      <X className="h-5 w-5 text-slate-500" />
                    </button>
                  </div>
                  <form data-testid="form-companion" onSubmit={handleSaveCompanion} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet</label>
                      <input
                        type="text"
                        value={compNom}
                        onChange={(e) => setCompNom(e.target.value)}
                        placeholder="ex: M. Ali"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Spécialité principale</label>
                      <input
                        type="text"
                        value={compSpecialite}
                        onChange={(e) => setCompSpecialite(e.target.value)}
                        placeholder="ex: Mécanicien Moteur"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Métier Principal</label>
                      <select
                        value={compMetierPrincipal}
                        onChange={(e) => setCompMetierPrincipal(e.target.value as AtelierMetier)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      >
                        {Object.values(AtelierMetier).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={compPlanifiable}
                          onChange={(e) => setCompPlanifiable(e.target.checked)}
                        />
                        <span>Planifiable</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={compActif}
                          onChange={(e) => setCompActif(e.target.checked)}
                        />
                        <span>Actif</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Utilisateur lié</label>
                      <select
                        value={compLinkedUserId}
                        onChange={(e) => setCompLinkedUserId(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      >
                        <option value="">Aucun compte lié</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.username} ({u.displayName})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAddCompanionModal(false)}
                        className="bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        data-testid="btn-save-companion"
                        className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MATERIALS */}
        {activeTab === "materials" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Ressources Matérielles de l'Atelier</h2>
              {canManageResourceRepository(activeRole, "materials") && (
                <button
                  data-testid="btn-add-material"
                  onClick={() => { resetMaterialForm(); setShowAddMaterialModal(true); }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                >
                  <Plus className="h-4 w-4" /> Ajouter une ressource
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table data-testid="table-materials" className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Identifiant</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Catégorie</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Localisation</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Capacité</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Planifiable</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                    {canManageResourceRepository(activeRole, "materials") && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {baysList.map(m => (
                    <tr key={m.id} data-testid={`row-material-${m.id}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-xs">{m.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">{m.name || m.nom}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700 text-sm font-semibold">{m.categorie || "Non classé"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-sm">{m.localisation || "Atelier"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-sm">{m.capaciteVehicules ?? 1} véh.</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-sm">
                        {m.planifiable !== false ? "Oui" : "Non"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.actif !== false ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {m.actif !== false ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      {canManageResourceRepository(activeRole, "materials") && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => {
                              setEditingMaterial(m);
                              setBayId(m.id);
                              setBayName(m.name || m.nom || "");
                              setBayCategorie(m.categorie || MaterialCategory.PONT_SERVICE_RAPIDE);
                              setBayActif(m.actif !== false);
                              setBayPlanifiable(m.planifiable !== false);
                              setBayCapacite(m.capaciteVehicules ?? 1);
                              setBayCompatibleTasks(m.compatibleTaskTypes ? m.compatibleTaskTypes.join(", ") : "");
                              setBayLocalisation(m.localisation || "Atelier NIMR");
                              setErrorMsg(null);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteMaterial(m.id)}
                            className="text-rose-600 hover:text-rose-900"
                          >
                            Supprimer
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Editing material panel */}
            {editingMaterial && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="font-bold text-slate-800 mb-4">Modifier la ressource matérielle {editingMaterial.name}</h3>
                <form data-testid="form-material" onSubmit={handleSaveMaterial} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la ressource</label>
                    <input
                      type="text"
                      value={bayName}
                      onChange={(e) => setBayName(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
                    <select
                      value={bayCategorie}
                      onChange={(e) => setBayCategorie(e.target.value as MaterialCategory)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    >
                      {Object.values(MaterialCategory).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Capacité véhicules</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={bayCapacite}
                      onChange={(e) => setBayCapacite(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tâches compatibles (séparées par des virgules)</label>
                    <input
                      type="text"
                      value={bayCompatibleTasks}
                      onChange={(e) => setBayCompatibleTasks(e.target.value)}
                      placeholder="ex: quick, oilService, mechanical"
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Localisation / Zone</label>
                    <input
                      type="text"
                      value={bayLocalisation}
                      onChange={(e) => setBayLocalisation(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bayPlanifiable}
                        onChange={(e) => setBayPlanifiable(e.target.checked)}
                      />
                      <span>Planifiable</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bayActif}
                        onChange={(e) => setBayActif(e.target.checked)}
                      />
                      <span>Active (Disponible)</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      data-testid="btn-save-material"
                      className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMaterial(null)}
                      className="bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Add material modal */}
            {showAddMaterialModal && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 text-lg">Créer une ressource matérielle</h3>
                    <button onClick={() => setShowAddMaterialModal(false)}>
                      <X className="h-5 w-5 text-slate-500" />
                    </button>
                  </div>
                  <form data-testid="form-material" onSubmit={handleSaveMaterial} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Identifiant unique (ID)</label>
                      <input
                        type="text"
                        value={bayId}
                        onChange={(e) => setBayId(e.target.value)}
                        placeholder="ex: bay_mecanique_01"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nom public</label>
                      <input
                        type="text"
                        value={bayName}
                        onChange={(e) => setBayName(e.target.value)}
                        placeholder="ex: Pont Double Ciseaux 1"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie matérielle</label>
                      <select
                        value={bayCategorie}
                        onChange={(e) => setBayCategorie(e.target.value as MaterialCategory)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      >
                        {Object.values(MaterialCategory).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bayPlanifiable}
                          onChange={(e) => setBayPlanifiable(e.target.checked)}
                        />
                        <span>Planifiable</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bayActif}
                          onChange={(e) => setBayActif(e.target.checked)}
                        />
                        <span>Active</span>
                      </label>
                    </div>
                    <div className="flex gap-2 justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAddMaterialModal(false)}
                        className="bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        data-testid="btn-save-material"
                        className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DIAGNOSTIC */}
        {activeTab === "diagnostic" && (
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-indigo-600" />
              Contrôles de cohérence et Alertes Référentiel
            </h2>

            {issues.length === 0 ? (
              <div className="p-8 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-xl text-center flex flex-col items-center justify-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-lg">Référentiel 100% Cohérent</h3>
                  <p className="text-sm text-emerald-700 mt-1">Aucune anomalie détectée dans le référentiel atelier.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3" data-testid="diagnostic-issues-list">
                {issues.map((issue, idx) => {
                  const isError = issue.severity === "error";
                  const itemTestId = `diagnostic-issue-${issue.code.toLowerCase()}`;
                  const msgTestId = `diagnostic-issue-message-${issue.code.toLowerCase()}`;
                  const sevTestId = `diagnostic-issue-severity-${issue.code.toLowerCase()}`;

                  return (
                    <div
                      key={idx}
                      data-testid={itemTestId}
                      className={`p-4 border rounded-lg flex items-start gap-3 transition-all ${
                        isError
                          ? "bg-rose-50 border-rose-200 text-rose-900"
                          : "bg-amber-50 border-amber-200 text-amber-900"
                      }`}
                    >
                      <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${isError ? "text-rose-600" : "text-amber-600"}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            data-testid={sevTestId}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                              isError ? "bg-rose-200 text-rose-800" : "bg-amber-200 text-amber-800"
                            }`}
                          >
                            {issue.severity}
                          </span>
                          <span className="text-xs font-mono text-slate-500">{issue.code}</span>
                        </div>
                        <p data-testid={msgTestId} className="text-sm font-medium mt-1">
                          {issue.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {pendingAction && (
        <div
          data-testid="resource-confirmation-panel"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-bold text-slate-800 text-lg">Confirmation requise</h3>
            </div>
            <p
              data-testid="resource-confirmation-message"
              className="text-sm text-slate-600 mb-6"
            >
              {pendingAction.message}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                data-testid="resource-confirmation-cancel"
                onClick={cancelPendingAction}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="resource-confirmation-confirm"
                onClick={executePendingAction}
                className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
