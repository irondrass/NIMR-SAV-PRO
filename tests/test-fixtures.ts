import { createReceptionDossier } from "../src/sav-core";
import { DossierSAV, InterventionType, DossierPriority, DossierStatus } from "../src/types";

export function makeTestDossier(overrides: Partial<DossierSAV> = {}): DossierSAV {
  const base = createReceptionDossier(
    {
      clientNom: "Client Test",
      clientTelephone: "+216 99 000 000",
      deposantNom: "Client Test",
      deposantTelephone: "+216 99 000 000",
      vehiculeMarque: "Dongfeng",
      vehiculeModele: "Shine Max",
      vehiculeImmatriculation: "000 TEST 00",
      vehiculeVIN: "VINTEST00000000000",
      vehiculeKilometrage: 10000,
      vehiculeCouleur: "Blanc",
      typeDossier: InterventionType.ENTRETIEN_RAPIDE,
      priorite: DossierPriority.NORMALE,
      plainteClient: "Test unitaire",
      observationsReception: "Test",
      photosAvant: [],
      niveauCarburant: 50,
      etatCarrosserie: { rayures: false, bosses: false, fissureParbrise: false, jantesAbimees: false, autresNotes: "" },
      objetsLaisses: [],
    },
    [],
    new Date("2026-06-12T08:00:00Z")
  );

  return {
    ...base,
    ...overrides,
  };
}
