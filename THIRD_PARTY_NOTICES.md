# Third-party notices

## Map data

Map geometry and some venue listings use OpenStreetMap data, © OpenStreetMap contributors, available under the Open Database License (ODbL). Preserve the visible attribution and source metadata when redistributing the map or database.

- https://www.openstreetmap.org/copyright
- https://opendatacommons.org/licenses/odbl/1-0/

Public-facility entries link to their sources.

## Map libraries

- Leaflet 1.9.4: BSD 2-Clause license. https://github.com/Leaflet/Leaflet
- Leaflet.markercluster: MIT license. https://github.com/Leaflet/Leaflet.markercluster

The corresponding license texts are included under `licenses/`.

## Fonts

The app loads Poiret One, Barlow Condensed, and Outfit from Google Fonts. Font files are not bundled in this export. Their upstream font-family repositories contain their licensing terms.

## Photos and video

The palm photo and the video footage were supplied by the project owner in the app-design conversation. This export does not grant additional rights to those media. `assets/video-sources.json` describes the source and edit selections.

## Street-map tile service

The raster fallback loads OpenStreetMap Standard raster tiles from https://tile.openstreetmap.org. No key is needed. Preserve visible OpenStreetMap attribution and normal HTTP caching; do not bulk-download or prefetch tiles. Service policy: https://operations.osmfoundation.org/policies/tiles/.

## V3 vector maps and venue data

- MapLibre GL JS 5.6.1, BSD 3-Clause: https://github.com/maplibre/maplibre-gl-js . The upstream license is bundled in `assets/maplibre-LICENSE.txt`.
- MapLibre GL Leaflet binding 0.1.4, ISC: https://github.com/maplibre/maplibre-gl-leaflet . Its license is bundled in `assets/maplibre-leaflet-LICENSE.txt`.
- Vector tile hosting: OpenFreeMap, https://openfreemap.org/ . Schema: OpenMapTiles, https://openmaptiles.org/ . Underlying geography and POI data: © OpenStreetMap contributors, ODbL 1.0. Preserve visible attribution, per-record source metadata, and source provenance when redistributing the directory.
- The central-area POI snapshot was extracted from public vector tiles dated November 15, 2026. The bundled snapshot import used 47,290,379 bytes across 216 tiles, below the published 50 MB / 3,000 tile download ceiling, with no more than three requests in parallel.
- Cartographic palettes and application styles are original IN A PINCH work inspired by Terraink’s poster-map approach. No Terraink source, logo, trademarked branding, or artwork is bundled.

## Nationwide map and facilities

The nationwide point and polygon-derived venue database in `data/atlas/` and its catalog are an OpenStreetMap-derived database under the Open Database License 1.0. © OpenStreetMap contributors. Geofabrik provides state extracts. OpenFreeMap provides public vector tiles. The shipped data and source manifest are available for reuse under those database terms. Import code is in the editable V5 source folder.

- https://download.geofabrik.de/north-america/us.html
- https://openfreemap.org/
- https://www.openstreetmap.org/copyright
- https://opendatacommons.org/licenses/odbl/1-0/

State and territory outlines come from the U.S. Census Bureau TIGERweb state layer, generalized for map display. Library branch records come from the Institute of Museum and Library Services FY 2024 Public Libraries Survey. The separately bundled federal truck-parking inventory comes from USDOT, Bureau of Transportation Statistics, National Transportation Atlas Database.

Operator locations and amenity facts in the separate travel-center directories come from the public Love’s location finder, Pilot’s location finder, and TravelCenters of America’s location download. Each listing links to its source. Brand names identify the operators. A listed amenity describes the source record at the time of collection.

## V5 lodging locations and property amenities

The November 21, 2026 snapshot combines names, street addresses and published business phone numbers from the U.S. Fire Administration’s Hotel-Motel National Master List with mapped property or street-range coordinates. The federal directory describes lodging that qualifies for official travel under federal fire-safety criteria. It provides no statement about a visitor’s right to use a lobby bathroom, dining room or shower. [USFA directory](https://apps.usfa.fema.gov/hotel) · [Full CSV](https://apps.usfa.fema.gov/hotel/api/properties/searchExport)

An exact U.S. Census Bureau street-address match estimates a point along the address range. It can fall on the street beside a hotel. The checked subset uses matching state, ZIP, house number and a point inside the named state. Existing OpenStreetMap hotel or motel points retain their location when linked to a federal record. OpenStreetMap contributors’ coordinates and the database that incorporates them are available under ODbL 1.0. The method of positioning is recorded for each property. [Census Geocoder documentation](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html) · [OpenStreetMap attribution and license](https://www.openstreetmap.org/copyright)

The Plaza in New York, W Hoboken, Hyatt Regency Jersey City on the Hudson and Casa Marina Key West have individual room and on-site dining references. Each operator-confirmed entry includes links to that specific property’s room and restaurant pages. The private-room shower field is separate from visitor and travel-center shower filters.

For a reproducible build, save the USFA CSV under `work/usfa-master.csv`, use `scripts/geocode-hotel-addresses.mjs` for the Census match dictionary, then run `node scripts/import-lodging.mjs`. The compiled national file also requires the bundled area boundaries and location atlas. The website reads the finished data locally.

## V5 geography, local artwork and facility evidence

Municipal, town, and county geometry uses the U.S. Census Bureau's 2025 generalized cartographic boundaries. The separate New York City layer uses the Department of City Planning's 2020 Neighborhood Tabulation Areas. Both are generalized geographic references. Source URLs appear in `data/area-sources.json`. Additional nearby neighborhood point labels come from OpenStreetMap via OpenFreeMap.

Local palette references are credited in the atlas. The North American Vexillological Association's 2022 New American City Flags Survey provides reference colors for a subset of municipalities. The atlas transforms these colors for cartography. The 24 city panoramas are original illustrations. [NAVA survey](https://nava.org/2022-survey)

The hotel footprint and dining crosswalk uses OpenStreetMap-derived building polygons and facility points, with the ODbL attribution and reuse terms above. The relationship records geometric containment. Details link to an operator page when the operator identifies the venue. Nearby food and drink results use straight-line distance.
