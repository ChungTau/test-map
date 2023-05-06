import * as React from 'react';
import Map, { Layer, Source } from 'react-map-gl';

export default function App() {
  return (
    <Map
      mapboxAccessToken='pk.eyJ1IjoiZWR3YXJkb25pb25jIiwiYSI6ImNsYnZ5amRzajAzcXUzbnJ3dXo4aXgzbmEifQ.nwp6x4W6ffop_GeCAtIE2g'
      initialViewState={{
        longitude: 114,
        latitude: 22.4,
        zoom: 14,
        pitch:60
      }}
      style={{width: 600, height: 400}}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      terrain={{source:'mapbox-dem', exaggeration:1.5}}
    >
      <Source id='mapbox-dem' type='raster-dem' url='mapbox://mapbox.mapbox-terrain-dem-v1' tileSize={512}>
        <Layer id='sky' type='sky' paint={
          {
            "sky-type":'atmosphere',
            'sky-atmosphere-sun': [0.0, 0.0],
            'sky-atmosphere-sun-intensity': 15
          }
        }/>
      </Source>
    </Map>
  );
}