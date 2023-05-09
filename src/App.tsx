import Map, { Layer, MapRef, Marker, Source } from 'react-map-gl';
import GpxParser, { Point, Route, Track } from 'gpxparser';
import { useRef, useState } from 'react';
import { Feature, LineString, Position, Properties, lineString, point } from '@turf/helpers';
import { along, bbox } from '@turf/turf';
import { Box, Container, Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SwapIcon from '@mui/icons-material/SwitchLeft'
import PlayIcon from '@mui/icons-material/PlayArrow';
import {pulsingDot } from './PulsingDot';
import { CartesianGrid, Line, Tooltip, XAxis, LineChart, ResponsiveContainer, YAxis, Legend, TooltipProps, ZAxis } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

export default function App() {
  
  //states
  const [route, setRoute] = useState < Feature < LineString,Properties >| null > (null);
  const [currentPosition, setCurrentPosition] = useState<Position>();
  const [gpxDetails, setGpxDetails] = useState<Route[] | Track[]|undefined>(undefined);
  const [swapStyle, setSwapStyle] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  //refs
  const mapRef = useRef < MapRef > (null);

  let start = 0;
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
        let routeArray: any;
        if(parser.routes.length>0){
          routeArray = parser.routes;
        }else if(parser.tracks.length>0){
          routeArray = parser.tracks;
        }else{
          return;
        }
        setGpxDetails(routeArray);
        let dataSet:any[] = [];
        const positions = routeArray[0].points.map((node:Point)=>{
          const lat : number = node.lat;
          const lon : number = node.lon;
          const position : Position = [lon, lat];
          dataSet[dataSet.length] = {"lat":lat, "lon": lon, "ele": node.ele, "distance": (routeArray[0].distance.cumul[dataSet.length])/1000}
          return position;
        });
        setChartData(dataSet);
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

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<ValueType, NameType>) => {
    if (active) {
      if(payload){
        const payl = payload[0].payload;
        const position:Position=[payl.lon, payl.lat];
        setCurrentPosition(position);
        return (
          <div className="custom-tooltip" style={{backgroundColor:"#DDDDDD", paddingTop:2, paddingBottom:2, paddingLeft:16, paddingRight:16, opacity:0.92}}>
            <p className="distance">{`Distance : ${label.toFixed(2)} km`}</p>
            <p className="desc">{`Elevation : ${parseFloat(payload?.[0].value?.toString()!).toFixed(2)} m`}</p>
          </div>
        );
      }
    }
  
    return null;
  };

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
    <div style={{boxSizing:"border-box"}}>
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
      style={{width:'100vw', height:'80vh'}}
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
                'line-dasharray': [0,4,3]
            }}/>
        </Source>
    )}
    </Map>
    <Container maxWidth={false} style={{boxSizing: 'border-box',width:'100vw', height:'20vh', backgroundColor:'#333', padding:0}}>
    {route&&<ResponsiveContainer width="100%" height="90%">
      <LineChart
        width={Math.max(
          document.body.scrollWidth,
          document.documentElement.scrollWidth,
          document.body.offsetWidth,
          document.documentElement.offsetWidth,
          document.documentElement.clientWidth
        )}
        height={230}
        data={chartData}
        onClick={()=>{console.log();}}
        margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
      >
        <XAxis dataKey="distance" type="number"
          tickFormatter={(value) => value.toFixed(2)}
          tickCount={10}
          domain={["dataMin", "dataMax"]}
          allowDecimals={true} />
        <YAxis  dataKey="ele" tickFormatter={(value)=>value.toFixed(0)} axisLine={false} tickLine={false}  />
        <Tooltip content={<CustomTooltip />} />
        <CartesianGrid stroke="#f5f5f5"  />
        <Line type="monotone" dataKey="ele" stroke="#ff7300" yAxisId={0} dot={false} onMouseMove={(event: any) => {
          const { chartX, chartY } = event;
          console.log(`Mouse coordinates: (${chartX}, ${chartY})`);
          // Perform your desired action here
        }}/>
      </LineChart>
      </ResponsiveContainer>}
    </Container>
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
    </div>
  );
}
