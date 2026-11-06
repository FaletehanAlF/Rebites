/* Deklarasi tipe untuk impor CSS pihak ketiga (MapLibre).
 * Next.js/Turbopack menangani impor CSS saat build, tetapi tsc memerlukan
 * deklarasi modul agar `import 'maplibre-gl/dist/maplibre-gl.css'` valid. */
declare module '*.css';
