import { Map, NavigationControl, ScaleControl, Popup } from 'maplibre-gl/dist/maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import { LayerSwitcherControl } from './layer-switcher-control';
import search from './search';
import DEFAULT_OPTIONS from '../defaults';
import { Wait } from '../../utils';


export class MapLibreExt extends Map {
    constructor(container) {
        let options = Object.assign({ container: container }, DEFAULT_OPTIONS);
        super(options);

        this._wait = new Wait({ id: container });
        this.setStyle({
            version: 8,
            glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
            sources: {
                'Plan IGN V2': {
                    type: 'raster',
                    tiles: [
                        'https://wxs.ign.fr/cartes/geoportail/wmts?SERVICE=WMTS&style=normal&VERSION=1.0.0&REQUEST=GetTile&format=image/png&layer=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&tilematrixset=PM&TileMatrix={z}&TileCol={x}&TileRow={y}'
                    ],
                    tileSize: 256,
                    attribution:'Orthophotos <a target="_top" rel="noopener" href="http://www.ign.fr">IGN</a>'
                }
            },
            layers: [{
                id: 'Plan IGN V2',
                type: 'raster',
                source: 'Plan IGN V2',
                minzoom: 0,
                maxzoom: 22
            }]    
        });

        // Ajout des controles
        this.addControl(new ScaleControl());
        this.addControl(new MaplibreGeocoder({ forwardGeocode: search }, {
            minLength: 3,
            showResultsWhileTyping: true,
            clearAndBlurOnEsc: true,
            clearOnBlur: true,
            marker: false,
            zoom: 14
        }), 'top-left');
        this.addControl(new NavigationControl({ visualizePitch: true }), 'top-left');

        this.on('load', this.onLoad);
    }

    onLoad() {
        this._wait.show("Chargement des tuiles vecteurs du PCI");

        this.addPCI().then(result => {
            for (const [id, source] of Object.entries(result.sources)) {
                this.addSource(id, source);
            }
            
            result.layers.forEach(layer => {
                this.addLayer(layer);
                
                this.on('mouseenter', layer.id, () => {
                    this.getCanvas().style.cursor = 'pointer';
                });
                        
                // Change it back to a pointer when it leaves.
                this.on('mouseleave', layer.id, () => {
                    this.getCanvas().style.cursor = '';
                });

                this.on('click', layer.id, (e) => {
                    let form = this.createForm(e.features[0]);
                    new Popup()
                        .setLngLat(e.lngLat)
                        .setHTML(form.outerHTML)
                        .addTo(this);
                });
            })
            this.addControl(new LayerSwitcherControl());
            this._wait.hide();
        }).catch(err => {
            console.log(err.message);
            this._wait.hide();
        })
    }

    /**
     * Ajout de la couche PCI
     * @returns 
     */
    async addPCI() {
        let response = await fetch('https://wxs.ign.fr/static/vectorTiles/styles/PCI/pci.json');
        let style = await response.json();

        let result = { sources: {}, layers: [] };
        for (const [id, source] of Object.entries(style.sources)) {
            source.scheme = 'xyz';
            result.sources[id] = source;
        }

        style.layers.forEach(layer => {
            if ('layout' in layer && 'text-font' in layer.layout) {
                layer.layout['text-font'] = ["Open Sans Bold Italic"];
            }
            result.layers.push(layer);
        });

        return Promise.resolve(result);
    }

    /**
     * Creation du formulaire d'un feature
     * @param Object feature 
     * @returns 
     */
    createForm(feature) {
        let properties = feature.properties;
        let layer = feature.layer.id;

        let table = document.createElement('table');
        let tbody = document.createElement('tbody');
        table.append(tbody);

        let tr = document.createElement('tr');
        
        let td = document.createElement('td');
        td.className = "bg-primary text-center text-white";
        td.setAttribute('colspan', 2);
        td.innerHTML = `<h5>${layer}</h5>`;
        tr.append(td);
        tbody.append(tr);

        for (const [name, value] of Object.entries(properties)) {
            let tr = document.createElement('tr');

            let td = document.createElement('td');
            td.innerHTML = `<span class="font-weight-bold">${name}</span>`;
            tr.append(td);

            td = document.createElement('td');
            td.innerHTML = value;
            tr.append(td);

            tbody.append(tr);
        }
        
        return table;
    }
}