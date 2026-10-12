import type { Venue } from "@/constants/venues"

/**
 * Small pool of test professionals per category. The booking flow lets the
 * client pick one (or "no preference"); the detail page shows a short strip.
 * Names/specialties are test data until the database is connected.
 */
export interface Professional {
  id: string
  name: string
  /** Key under `venues.professionals.specialties.*`. */
  specialtyKey: string
  /** Years of experience, shown as a badge on the detail page. */
  experience: number
  categoryIds: string[]
}

export const PROFESSIONALS: Professional[] = [
  {
    id: "julio-santana",
    name: "Julio Santana",
    specialtyKey: "venues.professionals.specialties.barber",
    experience: 12,
    categoryIds: ["barberia"],
  },
  {
    id: "ramon-cruz",
    name: "Ramón de la Cruz",
    specialtyKey: "venues.professionals.specialties.cuts",
    experience: 8,
    categoryIds: ["barberia"],
  },
  {
    id: "isabel-mena",
    name: "Isabel Mena",
    specialtyKey: "venues.professionals.specialties.brows",
    experience: 7,
    categoryIds: ["cejasPestanas"],
  },
  {
    id: "karina-vasquez",
    name: "Karina Vásquez",
    specialtyKey: "venues.professionals.specialties.lashes",
    experience: 6,
    categoryIds: ["cejasPestanas"],
  },
  {
    id: "elena-rivas",
    name: "Elena Rivas",
    specialtyKey: "venues.professionals.specialties.facial",
    experience: 10,
    categoryIds: ["cuidadoPiel"],
  },
  {
    id: "camila-peralta",
    name: "Camila Peralta",
    specialtyKey: "venues.professionals.specialties.treatments",
    experience: 5,
    categoryIds: ["cuidadoPiel"],
  },
  {
    id: "rosa-taveras",
    name: "Rosa Taveras",
    specialtyKey: "venues.professionals.specialties.waxing",
    experience: 9,
    categoryIds: ["depilacion"],
  },
  {
    id: "natalia-guzman",
    name: "Natalia Guzmán",
    specialtyKey: "venues.professionals.specialties.laser",
    experience: 6,
    categoryIds: ["depilacion"],
  },
  {
    id: "lourdes-cabral",
    name: "Lourdes Cabral",
    specialtyKey: "venues.professionals.specialties.social",
    experience: 8,
    categoryIds: ["maquillaje"],
  },
  {
    id: "veronica-herrera",
    name: "Verónica Herrera",
    specialtyKey: "venues.professionals.specialties.bridal",
    experience: 11,
    categoryIds: ["maquillaje"],
  },
  {
    id: "david-pena",
    name: "David Peña",
    specialtyKey: "venues.professionals.specialties.massage",
    experience: 9,
    categoryIds: ["masaje"],
  },
  {
    id: "yolanda-cedeno",
    name: "Yolanda Cedeño",
    specialtyKey: "venues.professionals.specialties.stones",
    experience: 7,
    categoryIds: ["masaje"],
  },
]

/** Professionals who work at a venue (by its category), max two. */
export function getVenueProfessionals(venue: Venue): Professional[] {
  return PROFESSIONALS.filter((item) => item.categoryIds.includes(venue.categoryId)).slice(0, 2)
}

export function getProfessionalById(id: string): Professional | undefined {
  return PROFESSIONALS.find((item) => item.id === id)
}
