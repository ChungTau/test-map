import * as React from 'react';
import Map, { Layer, MapRef, Marker, Source } from 'react-map-gl';
import GpxParser, { Route, Track } from 'gpxparser';
import { useRef, useState } from 'react';
import { Feature, LineString, Position, Properties, lineString, point } from '@turf/helpers';
import { along, bbox } from '@turf/turf';
import { Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SwapIcon from '@mui/icons-material/SwitchLeft'
import PlayIcon from '@mui/icons-material/PlayArrow';
import {pulsingDot } from './PulsingDot';

export default function App() {
  
  //states
  const [route, setRoute] = useState < Feature < LineString,Properties >| null > (null);
  const [currentPosition, setCurrentPosition] = useState<Position>();
  const [gpxDetails, setGpxDetails] = useState<Route[] | Track[]|undefined>(undefined);
  const [lineDashed, setLineDashed] = useState < number[] > ([0, 4, 3]);
  const [swapStyle, setSwapStyle] = useState(false);
  //refs
  const mapRef = useRef < MapRef > (null);
  //vars
  let start:number = 0;
  //constants
  const dashArraySequence = [
    [0, 4, 3],
    [0.5, 4, 2.5],
    [1, 4, 2],
    [1.5, 4, 1.5],
    [2, 4, 1],
    [2.5, 4, 0.5],
    [3, 4, 0],
    [0, 0.5, 3, 3.5],
    [0, 1, 3, 3],
    [0, 1.5, 3, 2.5],
    [0, 2, 3, 2],
    [0, 2.5, 3, 1.5],
    [0, 3, 3, 1],
    [0, 3.5, 3, 0.5]
  ];

  //functions
  const computeCameraPosition = (
    pitch:number,
    bearing:number,
    targetPosition:any,
    altitude:number,
    smooth = false
   ) => {
    var bearingInRadian = bearing / 57.29;
    var pitchInRadian = (90 - pitch) / 57.29;
    
    var lngDiff =
      ((altitude / Math.tan(pitchInRadian)) *
        Math.sin(-bearingInRadian)) /
      70000; // ~70km/degree longitude
    var latDiff =
      ((altitude / Math.tan(pitchInRadian)) *
        Math.cos(-bearingInRadian)) /
      110000 // 110km/degree latitude
    
    var correctedLng = targetPosition[0] + lngDiff;
    var correctedLat = targetPosition[1] - latDiff;
    
    const newCameraPosition = {
      lng: correctedLng,
      lat: correctedLat
    };
  
    return newCameraPosition
   }
   const animateDashArray = (timestamp : number) => {
    const index = Math.floor(timestamp / 100) % dashArraySequence.length;
    setLineDashed(dashArraySequence[index]);
    requestAnimationFrame(animateDashArray);
  }
  const handleFabClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gpx';
    input.onchange = handleFileSelect;
    input.click();
  }

  const handleFileSelect = (event: Event) =>{
    const file = (event.target as HTMLInputElement).files && (event.target as any).files[0];
    if (file && file.name.endsWith('.gpx')) {
      const reader = new FileReader();
      console.log(`Selected file: ${file.name}`);
      reader.onload = (event) => {
        const gpx = event.target?.result as string;
        const parser = new GpxParser();
        parser.parse(gpx);
        let routeArray;
        if(parser.routes.length>0){
          routeArray = parser.routes;
        }else if(parser.tracks.length>0){
          routeArray = parser.tracks;
        }else{
          return;
        }
        setGpxDetails(routeArray);
        const positions = routeArray[0].points.map((node:any)=>{
          const lat : number = parseFloat(node.lat);
          const lon : number = parseFloat(node.lon);
          const position : Position = [lon, lat];
          return position;
        });
        const newRoute = lineString(positions);
        setRoute(newRoute);
        setCurrentPosition(newRoute.geometry.coordinates[0]);
        //mapRef.current?.addImage('pulsing-dot', pulsingDot, {pixelRatio:2});
        pulsingDot.onAdd(mapRef);
        pulsingDot.render(mapRef);
        const boundOfRoute = bbox(newRoute);
        mapRef.current
            ?.fitBounds([
                [boundOfRoute[0], boundOfRoute[1]],
                [boundOfRoute[2], boundOfRoute[3]]
            ],{duration:2000, padding:20});
        requestAnimationFrame(animateDashArray);
      }
      reader.readAsText(file);
    }
  }

  const handleStyleSwapClick =() =>{
    setSwapStyle(!swapStyle);
    console.log(swapStyle);
  }

  const handleFlyButton = () => {
    if(mapRef.current){
      if(currentPosition){
        //const camera = mapRef.current?.getFreeCameraOptions();
        //const newPos = computeCameraPosition(32, 0, currentPosition, 1000);
        mapRef.current.flyTo({center: [currentPosition[0], currentPosition[1]], pitch:50, bearing:0, duration:2000, zoom:15});
        setTimeout(()=>{
          window.requestAnimationFrame(animateFlyAlongRoute);
        },2400);
      }
    }
  }

  const animateFlyAlongRoute = (time:number)=>{
    if(!start)start = time;
    const animationPhase = (time - start)/gpxDetails?.[0].distance.total!/4;
    if(animationPhase > 1){
      const boundOfRoute = bbox(route);
      mapRef.current
      ?.fitBounds([
          [boundOfRoute[0], boundOfRoute[1]],
          [boundOfRoute[2], boundOfRoute[3]]
      ],{duration:2000, padding:20});
      return;
    }
    if(route && gpxDetails){
      const alongPath = along(route, gpxDetails?.[0].distance.total/1000 * animationPhase).geometry.coordinates;
      setCurrentPosition(alongPath);
      const bearing = 0 + animationPhase * 200.0;
      if(mapRef.current){
        //const newPos = computeCameraPosition(42, bearing, alongPath, 1000);
        mapRef.current.easeTo({center:[alongPath[0], alongPath[1]], pitch:50, bearing:bearing, zoom:15, duration:0});
        window.requestAnimationFrame(animateFlyAlongRoute);
      }
    }
  }

  return (
    <>
    <Map
      id='map'
      ref={mapRef}
      mapboxAccessToken='pk.eyJ1IjoiZWR3YXJkb25pb25jIiwiYSI6ImNsYnZ5amRzajAzcXUzbnJ3dXo4aXgzbmEifQ.nwp6x4W6ffop_GeCAtIE2g'
      initialViewState={{
        longitude: 114,
        latitude: 22.4,
        zoom: 14,
        pitch:20
      }}
      style={{width:'100vw', height:'100vh'}}
      terrain={{source: 'mapbox-dem', exaggeration: 1.5}}
      mapStyle={(swapStyle)?"mapbox://styles/mapbox/satellite-v9":"mapbox://styles/edwardonionc/clhbgbxbk000901pvgwba9sp0"} 
    >
      <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxzoom={14}
        />
      {route && (
        <Source id='point' type='geojson' data={point(currentPosition!)}>
          <Layer id='point' type='circle' paint={{'circle-color':"#8deafc", "circle-radius":14, "circle-stroke-color": "#EEEEEE", "circle-stroke-width":5, "circle-stroke-opacity":0.75}}/>
        </Source>
      )
      
      }

    {route && (
        <Source id="routeSource" type='geojson' lineMetrics={true} data={route}>
            <Layer
                id='line-background'
                type='line'
                
                paint={{
                "line-color": 'yellow',
                "line-width": 4,
                'line-opacity': 0.4
            }}/>
            <Layer
                id='line-dashed'
                type='line'
                paint={{
                "line-color": 'yellow',
                'line-opacity': 0.8,
                "line-width": 4,
                'line-dasharray': lineDashed
            }}/>
        </Source>
    )}
    </Map>
    <Fab color="primary" size='small' aria-label="add" style={{position:"absolute", top:10, right:10}} onClick={handleFabClick}>
      <AddIcon/>
    </Fab>
    <Fab color="primary" size='small' aria-label="swap" style={{position:"absolute", top:70, right:10}} onClick={handleStyleSwapClick}>
      <SwapIcon/>
    </Fab>
    {
      route && (
        <Fab
          onClick={handleFlyButton}
          color="primary"
          size='small'
          aria-label="play"
          style={{
            position: 'absolute',
            right: 10,
            top: 130
          }}
        >
        <PlayIcon/>
        </Fab>
      )
    }
    </>
  );
}
