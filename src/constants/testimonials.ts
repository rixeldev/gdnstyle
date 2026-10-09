export interface Testimonial {
  id: string
  name: string
  initials: string
  rating: number
  categoryKey: string
}

/** In-app style reviews shown in the landing testimonials marquee. */
export const TESTIMONIALS: Testimonial[] = [
  {
    id: "lucia",
    name: "Lucía M.",
    initials: "LM",
    rating: 5,
    categoryKey: "categories.barberia",
  },
  {
    id: "carla",
    name: "Carla R.",
    initials: "CR",
    rating: 5,
    categoryKey: "categories.cejasPestanas",
  },
  {
    id: "andrea",
    name: "Andrea P.",
    initials: "AP",
    rating: 4,
    categoryKey: "categories.cuidadoPiel",
  },
  {
    id: "valentina",
    name: "Valentina S.",
    initials: "VS",
    rating: 5,
    categoryKey: "categories.depilacion",
  },
  {
    id: "marta",
    name: "Marta L.",
    initials: "ML",
    rating: 5,
    categoryKey: "categories.maquillaje",
  },
  {
    id: "sofia",
    name: "Sofía G.",
    initials: "SG",
    rating: 4,
    categoryKey: "categories.masaje",
  },
]
