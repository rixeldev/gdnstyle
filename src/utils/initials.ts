/** First letters of the first `count` words in a name (for avatar chips). */
export function initials(name: string, count = 2): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, count)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
