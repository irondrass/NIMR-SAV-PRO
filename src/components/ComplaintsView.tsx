/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  FileText,
  History,
  Inbox,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
} from "lucide-react";
import {
  ComplaintCriticity,
  DossierSAV,
  ReclammationClient,
  UserRole,
} from "../types";
import {
  ActiveComplaintStatus,
  COMPLAINT_CRITICITY_LABELS,
  COMPLAINT_STATUSES,
  COMPLAINT_STATUS_LABELS,
  addComplaintAction,
  assignComplaintOwner,
  canCreateComplaint,
  canEditComplaint,
  canReopenComplaint,
  changeComplaintStatus,
  closeComplaint,
  createComplaint,
  filterComplaints,
  getComplaintTimeline,
  isComplaintLinkedToReadyDelivery,
  isComplaintOpen,
  isComplaintOverdue,
  normalizeComplaint,
  normalizeComplaintStatus,
  reopenComplaint,
  updateComplaint,
} from "../complaints-workflow";
import { StatusBadge } from "./UIParts";

interface ComplaintsViewProps {
  reclamations: ReclammationClient[];
  dossiers: DossierSAV[];
  existingReclamationIds: string[];
  userRole: UserRole;
  currentUserLabel: string;
  onAddReclamation: (rec: ReclammationClient) => void;
  onUpdateReclamation: (updated: ReclammationClient) => void;
  onSelectDossier: (dossierId: string) => void;
}

type StatusFilter = ActiveComplaintStatus | "toutes";
type CriticityFilter = ComplaintCriticity | "toutes";

interface ComplaintDraft {
  responsable?: string;
  criticite?: ComplaintCriticity;
  statut?: ActiveComplaintStatus;
  actionCorrective?: string;
  commentaire?: string;
}

const statusFilterLabels: Record<StatusFilter, string> = {
  toutes: "Toutes",
  nouvelle: "Nouvelles",
  en_analyse: "En analyse",
  action_corrective: "Action corrective en cours",
  attente_client: "En attente client",
  resolue: "Résolues",
  cloturee: "Clôturées",
  reouverte: "Réouvertes",
};

const criticityClasses: Record<ComplaintCriticity, string> = {
  basse: "bg-slate-100 text-slate-700 border-slate-200",
  moyenne: "bg-amber-50 text-amber-800 border-amber-100",
  haute: "bg-orange-50 text-orange-800 border-orange-100",
  critique: "bg-red-50 text-red-800 border-red-200",
};

const statusClasses: Record<ActiveComplaintStatus, string> = {
  nouvelle: "bg-blue-50 text-blue-700 border-blue-100",
  en_analyse: "bg-indigo-50 text-indigo-700 border-indigo-100",
  action_corrective: "bg-amber-50 text-amber-800 border-amber-100",
  attente_client: "bg-violet-50 text-violet-700 border-violet-100",
  resolue: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cloturee: "bg-slate-100 text-slate-700 border-slate-200",
  reouverte: "bg-red-50 text-red-700 border-red-100",
};

export default function ComplaintsView({
  reclamations,
  dossiers,
  existingReclamationIds,
  userRole,
  currentUserLabel,
  onAddReclamation,
  onUpdateReclamation,
  onSelectDossier,
}: ComplaintsViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("toutes");
  const [criticityFilter, setCriticityFilter] = useState<CriticityFilter>("toutes");
  const [responsableFilter, setResponsableFilter] = useState("");
  const [dossierFilter, setDossierFilter] = useState("");
  const [query, setQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ComplaintDraft>>({});
  const [form, setForm] = useState({
    dossierId: "",
    clientNom: "",
    vehiculeNom: "",
    immatriculation: "",
    motif: "",
    criticite: "moyenne" as ComplaintCriticity,
    responsable: "",
    actionCorrective: "",
    delaiCible: "",
  });

  const actor = useMemo(() => ({
    user: currentUserLabel,
    role: userRole,
  }), [currentUserLabel, userRole]);

  const normalizedComplaints = useMemo(() => reclamations.map(normalizeComplaint), [reclamations]);
  const filteredComplaints = useMemo(() => filterComplaints(normalizedComplaints, {
    status: statusFilter,
    criticite: criticityFilter,
    responsable: responsableFilter,
    dossierId: dossierFilter,
    query,
  }), [criticityFilter, dossierFilter, normalizedComplaints, query, responsableFilter, statusFilter]);

  const openCriticalCount = normalizedComplaints.filter(rec => rec.criticite === "critique" && isComplaintOpen(rec)).length;
  const overdueCount = normalizedComplaints.filter(rec => isComplaintOverdue(rec)).length;
  const waitingCustomerCount = normalizedComplaints.filter(rec => normalizeComplaintStatus(rec.statut) === "attente_client").length;
  const readyDeliveryCount = normalizedComplaints.filter(rec => isComplaintOpen(rec) && isComplaintLinkedToReadyDelivery(rec, dossiers)).length;
  const canCreate = canCreateComplaint(userRole);

  const updateFormField = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateDraft = <K extends keyof ComplaintDraft>(complaintId: string, field: K, value: ComplaintDraft[K]) => {
    setDrafts(prev => ({
      ...prev,
      [complaintId]: {
        ...prev[complaintId],
        [field]: value,
      },
    }));
  };

  const getDraft = (rec: ReclammationClient): Required<ComplaintDraft> => {
    const normalized = normalizeComplaint(rec);
    const draft = drafts[rec.id] ?? {};
    return {
      responsable: draft.responsable ?? normalized.responsable,
      criticite: draft.criticite ?? normalized.criticite,
      statut: draft.statut ?? normalizeComplaintStatus(normalized.statut),
      actionCorrective: draft.actionCorrective ?? normalized.actionCorrective,
      commentaire: draft.commentaire ?? "",
    };
  };

  const resetForm = () => {
    setForm({
      dossierId: "",
      clientNom: "",
      vehiculeNom: "",
      immatriculation: "",
      motif: "",
      criticite: "moyenne",
      responsable: "",
      actionCorrective: "",
      delaiCible: "",
    });
    setFormError("");
  };

  const handleCreateComplaint = () => {
    if (!canCreate) return;
    if (!form.clientNom.trim() || !form.motif.trim()) {
      setFormError("Veuillez saisir au moins le client et le motif de la réclamation.");
      return;
    }

    const newComplaint = createComplaint({
      dossierId: form.dossierId,
      clientNom: form.clientNom,
      vehiculeNom: form.vehiculeNom,
      immatriculation: form.immatriculation,
      motif: form.motif,
      criticite: form.criticite,
      responsable: form.responsable,
      actionCorrective: form.actionCorrective,
      delaiCible: dateInputToIso(form.delaiCible),
    }, existingReclamationIds, actor);

    onAddReclamation(newComplaint);
    resetForm();
    setShowAddForm(false);
  };

  const handleSaveComplaint = (rec: ReclammationClient) => {
    const normalized = normalizeComplaint(rec);
    if (!canEditComplaint(userRole, normalized)) return;
    const draft = getDraft(normalized);
    const comment = draft.commentaire.trim() || "Suivi réclamation";
    let next = normalized;

    if (draft.responsable !== normalized.responsable) {
      next = assignComplaintOwner(next, draft.responsable, actor, comment);
    }
    if (draft.criticite !== normalized.criticite) {
      next = updateComplaint(next, { criticite: draft.criticite }, actor, comment);
    }
    if (draft.actionCorrective !== normalized.actionCorrective) {
      next = addComplaintAction(next, draft.actionCorrective, actor, comment);
    } else if (draft.commentaire.trim()) {
      next = updateComplaint(next, {}, actor, comment);
    }
    if (draft.statut !== normalizeComplaintStatus(normalized.statut)) {
      next = draft.statut === "cloturee"
        ? closeComplaint(next, actor, comment)
        : changeComplaintStatus(next, draft.statut, actor, comment);
    }

    onUpdateReclamation(next);
    setDrafts(prev => ({
      ...prev,
      [rec.id]: {
        responsable: next.responsable,
        criticite: next.criticite,
        statut: normalizeComplaintStatus(next.statut),
        actionCorrective: next.actionCorrective,
        commentaire: "",
      },
    }));
  };

  const handleResolveComplaint = (rec: ReclammationClient) => {
    if (!canEditComplaint(userRole, rec)) return;
    onUpdateReclamation(changeComplaintStatus(rec, "resolue", actor, "Réclamation marquée résolue"));
  };

  const handleCloseComplaint = (rec: ReclammationClient) => {
    if (!canEditComplaint(userRole, rec)) return;
    onUpdateReclamation(closeComplaint(rec, actor, "Clôture validée"));
  };

  const handleReopenComplaint = (rec: ReclammationClient) => {
    if (!canReopenComplaint(userRole, rec)) return;
    onUpdateReclamation(reopenComplaint(rec, actor, "Réouverture demandée"));
  };

  const findLinkedDossier = (rec: ReclammationClient) => dossiers.find(dossier => dossier.id === rec.dossierId);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              RÉCLAMATIONS CLIENTS & CONTENTIEUX SAV
            </h2>
            <p className="text-slate-400 text-xs text-left">Suivi des réclamations, actions correctives, responsables et clôtures</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canCreate && (
              <button
                type="button"
                data-testid="complaint-create-button"
                onClick={() => {
                  setFormError("");
                  setShowAddForm(current => !current);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Saisir Réclamation
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <AlertTile testId="complaints-alert-critical-open" icon={<ShieldAlert className="h-4 w-4" />} label="Critiques ouvertes" value={openCriticalCount} tone="red" />
          <AlertTile testId="complaints-alert-overdue" icon={<Clock className="h-4 w-4" />} label="En retard" value={overdueCount} tone="amber" />
          <AlertTile testId="complaints-alert-waiting-customer" icon={<Inbox className="h-4 w-4" />} label="Attente client" value={waitingCustomerCount} tone="violet" />
          <AlertTile testId="complaints-alert-ready-delivery" icon={<CheckCircle className="h-4 w-4" />} label="Liées à livraison" value={readyDeliveryCount} tone="emerald" />
        </div>
      </div>

      {showAddForm && canCreate && (
        <div data-testid="complaint-form" className="bg-white border border-red-200 rounded-lg p-5 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-black text-sm uppercase text-red-700">Nouveau dossier de litige client SAV</span>
            {formError && <span className="font-bold text-red-700">{formError}</span>}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Nom du client *">
              <input
                data-testid="complaint-client-input"
                type="text"
                className="w-full rounded border border-slate-200 bg-slate-50 p-2 font-semibold"
                placeholder="Ex: Client Démo 001"
                value={form.clientNom}
                onChange={(e) => updateFormField("clientNom", e.target.value)}
              />
            </FormField>

            <FormField label="Dossier technique lié">
              <input
                data-testid="complaint-dossier-input"
                type="text"
                className="w-full rounded border border-slate-200 bg-slate-50 p-2 font-bold"
                placeholder="Ex: NIMR-2026-002"
                value={form.dossierId}
                onChange={(e) => updateFormField("dossierId", e.target.value)}
              />
            </FormField>

            <FormField label="Véhicule">
              <input
                data-testid="complaint-vehicle-input"
                type="text"
                className="w-full rounded border border-slate-200 bg-slate-50 p-2 font-medium"
                placeholder="Forthing T5 EVO"
                value={form.vehiculeNom}
                onChange={(e) => updateFormField("vehiculeNom", e.target.value)}
              />
            </FormField>

            <FormField label="Immatriculation">
              <input
                data-testid="complaint-plate-input"
                type="text"
                className="w-full rounded border border-slate-200 bg-slate-50 p-2 font-mono font-bold"
                placeholder="000 TU 0001"
                value={form.immatriculation}
                onChange={(e) => updateFormField("immatriculation", e.target.value)}
              />
            </FormField>

            <FormField label="Criticité">
              <select
                data-testid="complaint-criticity-input"
                className="w-full rounded border border-slate-200 bg-slate-50 p-2 font-semibold"
                value={form.criticite}
                onChange={(e) => setForm(prev => ({ ...prev, criticite: e.target.value as ComplaintCriticity }))}
              >
                {(["basse", "moyenne", "haute", "critique"] as ComplaintCriticity[]).map(value => (
                  <option key={value} value={value}>{COMPLAINT_CRITICITY_LABELS[value]}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Responsable affecté">
              <input
                data-testid="complaint-owner-input"
                type="text"
                className="w-full rounded border border-slate-200 bg-slate-50 p-2 font-semibold"
                placeholder="Ex: Responsable SAV"
                value={form.responsable}
                onChange={(e) => updateFormField("responsable", e.target.value)}
              />
            </FormField>

            <FormField label="Délai cible">
              <input
                data-testid="complaint-deadline-input"
                type="datetime-local"
                className="w-full rounded border border-slate-200 bg-slate-50 p-2 font-semibold"
                value={form.delaiCible}
                onChange={(e) => updateFormField("delaiCible", e.target.value)}
              />
            </FormField>

            <FormField label="Action corrective">
              <input
                data-testid="complaint-action-input"
                type="text"
                className="w-full rounded border border-slate-200 bg-slate-50 p-2"
                placeholder="Prise en charge nettoyage, lavage gratuit, véhicule courtoisie..."
                value={form.actionCorrective}
                onChange={(e) => updateFormField("actionCorrective", e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Motif du mécontentement *">
            <textarea
              data-testid="complaint-reason-input"
              className="h-20 w-full rounded border border-slate-200 bg-slate-50 p-2"
              placeholder="Problème de traces de doigts, pièces démontées non restituées..."
              value={form.motif}
              onChange={(e) => updateFormField("motif", e.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(false);
              }}
              className="rounded bg-slate-100 px-4 py-2 font-bold text-slate-700"
            >
              Annuler
            </button>
            <button
              type="button"
              data-testid="complaint-submit"
              onClick={handleCreateComplaint}
              className="rounded bg-red-600 px-4 py-2 font-black text-white hover:bg-red-700"
            >
              Confirmer la création
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["toutes", ...COMPLAINT_STATUSES] as StatusFilter[]).map(status => (
            <button
              key={status}
              type="button"
              data-testid={`complaint-status-filter-${status}`}
              onClick={() => setStatusFilter(status)}
              className={`rounded-md border px-3 py-1.5 text-[11px] font-black transition ${
                statusFilter === status ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              {statusFilterLabels[status]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            data-testid="complaint-criticity-filter"
            className="rounded border border-slate-200 bg-slate-50 p-2 text-xs font-bold"
            value={criticityFilter}
            onChange={(e) => setCriticityFilter(e.target.value as CriticityFilter)}
          >
            <option value="toutes">Toutes criticités</option>
            {(["basse", "moyenne", "haute", "critique"] as ComplaintCriticity[]).map(value => (
              <option key={value} value={value}>{COMPLAINT_CRITICITY_LABELS[value]}</option>
            ))}
          </select>
          <input
            data-testid="complaint-owner-filter"
            className="rounded border border-slate-200 bg-slate-50 p-2 text-xs font-semibold"
            placeholder="Filtrer responsable"
            value={responsableFilter}
            onChange={(e) => setResponsableFilter(e.target.value)}
          />
          <input
            data-testid="complaint-dossier-filter"
            className="rounded border border-slate-200 bg-slate-50 p-2 text-xs font-semibold"
            placeholder="Filtrer dossier lié"
            value={dossierFilter}
            onChange={(e) => setDossierFilter(e.target.value)}
          />
          <input
            data-testid="complaint-search-input"
            className="rounded border border-slate-200 bg-slate-50 p-2 text-xs font-semibold"
            placeholder="Recherche client / véhicule / motif"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredComplaints.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-xs font-bold text-slate-400">
          Aucune réclamation ne correspond aux filtres.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredComplaints.map(rec => {
            const normalized = normalizeComplaint(rec);
            const status = normalizeComplaintStatus(normalized.statut);
            const draft = getDraft(normalized);
            const linkedDossier = findLinkedDossier(normalized);
            const editable = canEditComplaint(userRole, normalized);
            const reopenAllowed = canReopenComplaint(userRole, normalized);
            const overdue = isComplaintOverdue(normalized);

            return (
              <article
                key={normalized.id}
                data-testid="complaint-card"
                className={`rounded-lg border bg-white p-5 text-xs font-semibold shadow-sm ${normalized.criticite === "critique" && isComplaintOpen(normalized) ? "border-red-200" : "border-slate-200"}`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span data-testid="complaint-id" className="font-mono text-sm font-black text-slate-900">{normalized.id}</span>
                      <span data-testid="complaint-status-badge" className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${statusClasses[status]}`}>
                        {COMPLAINT_STATUS_LABELS[status]}
                      </span>
                      <span data-testid="complaint-criticity-badge" className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${criticityClasses[normalized.criticite]}`}>
                        {COMPLAINT_CRITICITY_LABELS[normalized.criticite]}
                      </span>
                      {overdue && (
                        <span data-testid="complaint-overdue-badge" className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-black uppercase text-red-700">
                          En retard
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-black text-slate-900">{normalized.clientNom}</h3>
                    <p className="text-[11px] text-slate-500">{normalized.vehiculeNom} {normalized.immatriculation && `- ${normalized.immatriculation}`}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {linkedDossier && (
                      <button
                        type="button"
                        data-testid="complaint-open-dossier"
                        onClick={() => onSelectDossier(linkedDossier.id)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-700 hover:border-blue-300 hover:text-blue-700"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Ouvrir dossier lié
                      </button>
                    )}
                    {editable && (
                      <button
                        type="button"
                        data-testid="complaint-save-button"
                        onClick={() => handleSaveComplaint(normalized)}
                        className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-slate-700"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Enregistrer
                      </button>
                    )}
                    {reopenAllowed && (
                      <button
                        type="button"
                        data-testid="complaint-reopen-button"
                        onClick={() => handleReopenComplaint(normalized)}
                        className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-red-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Rouvrir
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
                  <span className="mb-1 block font-black text-red-700">Motif du mécontentement :</span>
                  {normalized.motif}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ReadonlyField label="Dossier lié" value={normalized.dossierId} testId="complaint-linked-dossier" />
                  <ReadonlyField label="Responsable" value={normalized.responsable} testId="complaint-owner-value" />
                  <ReadonlyField label="Action corrective" value={normalized.actionCorrective} testId="complaint-action-value" />
                  <ReadonlyField label="Délai cible" value={formatDate(normalized.delaiCible || normalized.delaiTraitement)} testId="complaint-deadline-value" />
                  <ReadonlyField label="Dernière modification" value={formatDate(normalized.dateDerniereModification ?? normalized.dateCreation)} testId="complaint-updated-value" />
                </div>

                {linkedDossier && (
                  <div data-testid="complaint-linked-dossier-summary" className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3 text-[11px] md:grid-cols-2">
                    <div><span className="text-slate-500">Statut dossier : </span><StatusBadge status={linkedDossier.statut} /></div>
                    <div><span className="text-slate-500">Client : </span><strong>{linkedDossier.clientNom}</strong></div>
                    <div><span className="text-slate-500">Véhicule : </span><strong>{linkedDossier.vehiculeMarque} {linkedDossier.vehiculeModele}</strong></div>
                    <div><span className="text-slate-500">QC / Livraison : </span><strong>{linkedDossier.checklistQC.validationGlobale} / {linkedDossier.livraison.confirmationReceptionClient ? "livraison confirmée" : "livraison non confirmée"}</strong></div>
                  </div>
                )}

                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  {editable ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormField label="Responsable affecté">
                        <input
                          data-testid="complaint-edit-owner"
                          className="w-full rounded border border-slate-200 bg-white p-2 font-semibold"
                          value={draft.responsable}
                          onChange={(e) => updateDraft(normalized.id, "responsable", e.target.value)}
                        />
                      </FormField>
                      <FormField label="Criticité">
                        <select
                          data-testid="complaint-edit-criticity"
                          className="w-full rounded border border-slate-200 bg-white p-2 font-semibold"
                          value={draft.criticite}
                          onChange={(e) => updateDraft(normalized.id, "criticite", e.target.value as ComplaintCriticity)}
                        >
                          {(["basse", "moyenne", "haute", "critique"] as ComplaintCriticity[]).map(value => (
                            <option key={value} value={value}>{COMPLAINT_CRITICITY_LABELS[value]}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Statut">
                        <select
                          data-testid="complaint-edit-status"
                          className="w-full rounded border border-slate-200 bg-white p-2 font-semibold"
                          value={draft.statut}
                          onChange={(e) => updateDraft(normalized.id, "statut", e.target.value as ActiveComplaintStatus)}
                        >
                          {COMPLAINT_STATUSES.map(value => (
                            <option key={value} value={value}>{COMPLAINT_STATUS_LABELS[value]}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Action corrective">
                        <input
                          data-testid="complaint-edit-action"
                          className="w-full rounded border border-slate-200 bg-white p-2 font-semibold"
                          value={draft.actionCorrective}
                          onChange={(e) => updateDraft(normalized.id, "actionCorrective", e.target.value)}
                        />
                      </FormField>
                      <div className="md:col-span-2">
                        <FormField label="Commentaire de suivi">
                          <textarea
                            data-testid="complaint-followup-comment"
                            className="h-16 w-full rounded border border-slate-200 bg-white p-2"
                            value={draft.commentaire}
                            onChange={(e) => updateDraft(normalized.id, "commentaire", e.target.value)}
                          />
                        </FormField>
                      </div>
                    </div>
                  ) : (
                    <div data-testid="complaint-readonly-message" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] font-bold text-slate-500">
                      Consultation uniquement.
                    </div>
                  )}

                  {editable && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-testid="complaint-resolve-button"
                        onClick={() => handleResolveComplaint(normalized)}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700"
                      >
                        Marquer résolue
                      </button>
                      <button
                        type="button"
                        data-testid="complaint-close-button"
                        onClick={() => handleCloseComplaint(normalized)}
                        className="rounded bg-slate-700 px-3 py-1.5 text-[10px] font-black text-white hover:bg-slate-800"
                      >
                        Clôturer
                      </button>
                    </div>
                  )}
                </div>

                <div data-testid="complaint-timeline" className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase text-slate-500">
                    <History className="h-4 w-4" />
                    Historique réclamation
                  </div>
                  {getComplaintTimeline(normalized).map(entry => (
                    <div key={entry.id} data-testid="complaint-history-entry" className="rounded border border-slate-100 bg-slate-50 p-2.5 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-black text-slate-800">{entry.action}</span>
                        <span className="font-mono text-[10px] text-slate-400">{formatDate(entry.date)}</span>
                      </div>
                      <div className="mt-1 text-slate-500">
                        {entry.utilisateur} · {entry.role}
                        {entry.ancienStatut && entry.nouveauStatut && (
                          <span> · {COMPLAINT_STATUS_LABELS[normalizeComplaintStatus(entry.ancienStatut)]} → {COMPLAINT_STATUS_LABELS[normalizeComplaintStatus(entry.nouveauStatut)]}</span>
                        )}
                        {entry.nouveauResponsable && <span> · Responsable : {entry.nouveauResponsable}</span>}
                      </div>
                      {entry.commentaire && <p className="mt-1 text-slate-700">{entry.commentaire}</p>}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertTile({ testId, icon, label, value, tone }: { testId: string; icon: React.ReactNode; label: string; value: number; tone: "red" | "amber" | "violet" | "emerald" }) {
  const tones = {
    red: "border-red-100 bg-red-50 text-red-700",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    violet: "border-violet-100 bg-violet-50 text-violet-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };

  return (
    <div data-testid={testId} className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-xl font-black">{value}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-[11px] font-bold uppercase text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ReadonlyField({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded border border-slate-100 bg-slate-50 p-2">
      <span className="block text-[10px] font-black uppercase text-slate-400">{label}</span>
      <span className="font-bold text-slate-800">{value || "Non renseigné"}</span>
    </div>
  );
}

function dateInputToIso(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
}

function formatDate(value: string): string {
  if (!value) return "Non renseigné";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
