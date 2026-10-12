"use client"

import "leaflet/dist/leaflet.css"

import type { LayerGroup, Map as LeafletMap } from "leaflet"
import { useEffect, useRef } from "react"

export interface MapPoint {
  id: string
  name: string
  lat: number
  lon: number
  href?: string
}

interface VenueMapProps {
  points: MapPoint[]
  /** Tailwind classes for the map container (must include a height). */
  className?: string
  /** Accessible name for the map region. */
  label?: string
}

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

/**
 * Leaflet map with brand-coloured pins. Leaflet is imported dynamically so it
 * never runs during SSR (it touches `window` at import time).
 */
export function VenueMap({ points, className, label }: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)

  useEffect(() => {
    let cancelled = false
    let destroy: (() => void) | undefined

    void (async () => {
      const L = await import("leaflet")
      const container = containerRef.current
      if (cancelled || !container || mapRef.current) return

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const map = L.map(container, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
        zoomAnimation: !reduceMotion,
        fadeAnimation: !reduceMotion,
        markerZoomAnimation: !reduceMotion,
      })
      map.setView([18.9, -70.1], 8)
      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map
      layerRef.current = L.layerGroup().addTo(map)

      destroy = () => {
        map.remove()
        mapRef.current = null
        layerRef.current = null
      }
    })()

    return () => {
      cancelled = true
      destroy?.()
    }
  }, [])

  // Draw / redraw pins whenever the point set changes.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const L = await import("leaflet")
      const map = mapRef.current
      const layer = layerRef.current
      if (cancelled || !map || !layer) return

      layer.clearLayers()
      if (points.length === 0) return

      const icon = L.divIcon({
        className: "gdn-pin",
        html: '<span class="gdn-pin__dot"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -12],
      })

      points.forEach((point) => {
        const node = document.createElement("div")
        node.className = "gdn-popup"
        if (point.href) {
          const link = document.createElement("a")
          link.href = point.href
          link.className = "gdn-popup__link"
          link.textContent = point.name
          node.appendChild(link)
        } else {
          node.textContent = point.name
        }

        L.marker([point.lat, point.lon], { icon, title: point.name, alt: point.name })
          .bindPopup(node)
          .addTo(layer)
      })

      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lon], 15, { animate: false })
      } else {
        const bounds = L.latLngBounds(
          points.map((point) => [point.lat, point.lon] as [number, number]),
        )
        map.fitBounds(bounds.pad(0.2), { maxZoom: 12 })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [points])

  return <div ref={containerRef} className={className} role="region" aria-label={label} />
}
