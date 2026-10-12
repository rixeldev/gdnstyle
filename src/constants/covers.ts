/** Brand gradient used as a stand-in cover for venues/venues tiles. */
export const CATEGORY_COVERS: Record<string, string> = {
  barberia: "from-royal/55",
  cejasPestanas: "from-royal/40",
  cuidadoPiel: "from-royal/60",
  depilacion: "from-plum/70",
  maquillaje: "from-royal/65",
  masaje: "from-plum/60",
}

export function categoryCover(categoryId: string): string {
  return CATEGORY_COVERS[categoryId] ?? "from-royal/50"
}
