import { DossierSAV, UserRole, DossierStatus, DossierPriority, InterventionType, AtelierZone, TechnicienResource } from "../../src/types";

export function createMockDossier(overrides: Partial<DossierSAV>): DossierSAV {
  return {
    id: overrides.id || "NIMR-2026-TEST-" + Math.floor(Math.random() * 10000 + 1000),
    clientNom: "Test Client",
    clientTelephone: "+216 55 555 555",
    deposantNom: "Test Deposant",
    deposantTelephone: "+216 55 555 555",
    vehiculeMarque: "Forthing",
    vehiculeModele: "T5 EVO",
    vehiculeImmatriculation: "123 TU 4567",
    vehiculeVIN: "TESTVIN1234567890",
    vehiculeKilometrage: 10000,
    vehiculeCouleur: "Noir",
    typeDossier: InterventionType.ENTRETIEN_RAPIDE,
    priorite: DossierPriority.NORMALE,
    plainteClient: "Reviser freins",
    observationsReception: "RAS",
    photosAvant: [],
    niveauCarburant: 50,
    etatCarrosserie: {
      rayures: false,
      bosses: false,
      fissureParbrise: false,
      jantesAbimees: false,
      autresNotes: ""
    },
    objetsLaisses: [],
    dateReception: new Date().toISOString(),
    dateSouhaiteeLivraison: new Date(Date.now() + 86400000).toISOString(),
    statut: DossierStatus.VEHICULE_RECU,
    ordresReparation: [],
    complements: [],
    accords: [],
    checklistQC: {
      essaiEffectue: false,
      defautRepare: false,
      aucunVoyantAllume: false,
      niveauxVerifies: false,
      serrageSecurite: false,
      propreteVehicule: false,
      documentsPrets: false,
      photosApresOk: false,
      validationGlobale: "en_attente"
    },
    livraison: {
      controleQualiteOk: false,
      clientInforme: false,
      dateLivraisonPrevue: new Date(Date.now() + 86400000).toISOString(),
      remarquesLivraison: "",
      confirmationReceptionClient: false,
      clotureInterne: false
    },
    prochaineActionRecommended: "Planifier l'intervention",
    dateDernierStatut: new Date().toISOString(),
    avancementGlobal: 0,
    ...overrides
  };
}

export function createMockTech(overrides: Partial<TechnicienResource>): TechnicienResource {
  return {
    id: overrides.id || "tech_test_" + Math.floor(Math.random() * 1000),
    nom: overrides.nom || "Technicien Test",
    specialite: overrides.specialite || "Mécanique générale",
    disponibilite: overrides.disponibilite || "disponible",
    compétences: overrides.compétences || ["Entretien standard"],
    zoneAffectee: overrides.zoneAffectee || AtelierZone.MECANIQUE_RAPIDE,
    absencesConges: overrides.absencesConges || [],
    capaciteJournaliere: overrides.capaciteJournaliere || 8,
    chargeActuelle: overrides.chargeActuelle || 0,
    ...overrides
  };
}

export function createWorkshopTechnicians(): TechnicienResource[] {
  return [
    createMockTech({
      id: "tech_01",
      nom: "Technicien Atelier",
      specialite: "Mécanique générale / Diagnostic",
      disponibilite: "disponible",
      compétences: ["Entretien standard", "Diagnostic atelier"],
      zoneAffectee: AtelierZone.MECANIQUE_RAPIDE,
      capaciteJournaliere: 8,
      chargeActuelle: 0,
    }),
    createMockTech({
      id: "tech_02",
      nom: "Technicien Atelier 2",
      specialite: "Électricité / Diagnostic",
      disponibilite: "disponible",
      compétences: ["Diagnostic OBD", "Électricité véhicule"],
      zoneAffectee: AtelierZone.ELECTRICITE_DIAG,
      capaciteJournaliere: 8,
      chargeActuelle: 0,
    }),
  ];
}
