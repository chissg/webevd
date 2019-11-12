// TODO come up with a cool name
// TODO learn how imports/modules work
// TODO back/fwd buttons (need to serve differently?)
// TODO work well on ProtoDUNE
// TODO clear handling of disambiguation
// TODO look into gallery
// TODO plot IDEs
// TODO plot photons
// TODO pre-upload textures
// TODO Use textures for hits at long distances so they're visible
// TODO make SaveAs and Print work
//
//import { IcosahedronBufferGeometry } from './three.js-master/src/geometries/IcosahedronGeometry.js'

var scene = new THREE.Scene();

var camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 1e6 );

var renderer = new THREE.WebGLRenderer();
// I have no idea why these 4 pixels are necessary
renderer.setSize( window.innerWidth, window.innerHeight-4);

renderer.setClearColor('black');

renderer.alpha = true;
renderer.antialias = false;

document.body.appendChild( renderer.domElement );

function ArrToVec(arr)
{
    return new THREE.Vector3(arr[0], arr[1], arr[2]);
}

var mat_lin = new THREE.LineBasicMaterial({color: 'gray'});

var mat_hit = new THREE.MeshBasicMaterial({color: 'gray', side: THREE.DoubleSide});

var mat_sps = new THREE.MeshBasicMaterial({color: 'blue'});

function TextureLoadCallback(tex, mat, mipdim, texdim){
    console.log('Loaded callback', mipdim, texdim);

    // This is how you would create a data texture if necessary
    // var canvas = document.createElement('canvas');
    // canvas.width = tex.image.width;
    // canvas.height = tex.image.height;
    // var context = canvas.getContext('2d');
    // context.drawImage(tex.image, 0, 0);
    // var data = context.getImageData(0, 0, tex.image.width, tex.image.height).data;
    // let newtex = new THREE.DataTexture(data, tex.image.width, tex.image.height, THREE.RGBAFormat);

    // Until all the mipmaps are ready we stash them in the material
    if(mat.tmpmipmaps == undefined) mat.tmpmipmaps = {};
    mat.tmpmipmaps[mipdim] = tex.image;

    // Did we just succeed in loading the main texture?
    if(mipdim == texdim){
        tex.generateMipMaps = false;
        // Go pixely rather than blurry when zoomed right in
        tex.magFilter = THREE.NearestFilter;

        // Assign to the material and undo the temporary loading style
        mat.map = tex;
        mat.opacity = 1;
        mat.needsUpdate = true;
        requestAnimationFrame(animate);
    }

    // If the main texture is loaded
    if(mat.map != null){
        // And we have now loaded all of the mipmaps
        var ok = true;
        for(var i = 1; i <= texdim; i *= 2){
            if(!(i in mat.tmpmipmaps)) ok = false;
        }

        if(ok){
            // TODO - is it bad that the largest resolution image is in the
            // main map and also the first element in the mipmap list?
            for(var i = texdim; i >= 1; i /= 2){
                mat.map.mipmaps.push(mat.tmpmipmaps[i]);
            }
            delete mat.tmpmipmaps;

            mat.map.minFilter = THREE.LinearMipmapLinearFilter;
            // Necessary to not see block edges, but is super ugly...
            // Mostly because the wires are much wider than the ticks
            // mat.map.minFilter = THREE.NearestMipmapLinearFilter;

            mat.map.needsUpdate = true;
            mat.needsUpdate = true;
            requestAnimationFrame(animate);
        }
    }
}

// Cache so we can request the same texture material multiple times without
// duplication
var gtexmats = {};

function TextureMaterial(fname, texdim){
    if(fname in gtexmats) return gtexmats[fname];

    // Make the material a transparent solid colour until the texture loads
    var mat = new THREE.MeshBasicMaterial( { color: 'white', opacity: .1, side: THREE.DoubleSide, transparent: true, alphaTest: 1/512.} );
    gtexmats[fname] = mat;

    // Load all the mipmaps
    for(let d = texdim; d >= 1; d /= 2){
        new THREE.TextureLoader().load(fname+'_mip'+d+'.png',
                                       function(t){
                                           TextureLoadCallback(t, mat, d, texdim);
                                       },
                                       undefined,
                                       function(err){
                                           mat.opacity = 0;
                                           mat.needsUpdate;
                                           requestAnimationFrame(animate);
                                           console.log('error loading', fname, d, err);
                                       });
    }

    return mat;
}


var outlines = new THREE.Group();
var digs = new THREE.Group();
var wires = new THREE.Group();
var hits = new THREE.Group();
var reco_tracks = new THREE.Group();
var truth = new THREE.Group();

scene.add(outlines);
scene.add(digs);
scene.add(wires);
scene.add(hits);
scene.add(reco_tracks);
scene.add(truth);

var com = new THREE.Vector3();
var nplanes = 0;

var uperp = null;
var vperp = null;

function push_square_vtxs(c, du, dv, vtxs){
    var p1 = c.clone();
    var p2 = c.clone();
    var p3 = c.clone();
    var p4 = c.clone();

    // p1 = du-dv, p2 = du+dv, p3 = -du+dv, p4=-du-dv
    p1.add(du); p1.addScaledVector(dv, -1);
    p2.add(du); p2.add(dv);
    p3.addScaledVector(du, -1); p3.add(dv);
    p4.addScaledVector(du, -1); p4.addScaledVector(dv, -1);

    vtxs.push(p1.x, p1.y, p1.z,
              p2.x, p2.y, p2.z,
              p3.x, p3.y, p3.z,

              p1.x, p1.y, p1.z,
              p3.x, p3.y, p3.z,
              p4.x, p4.y, p4.z);
}

function push_icosahedron_vtxs(c, radius, vtxs, indices){
    const t = ( 1 + Math.sqrt( 5 ) ) / 2;

    const r0 = Math.sqrt(1+t*t);

    const vs = [
              -1, t, 0,
              1, t, 0,
              -1, -t, 0,
              1, -t, 0,
              0, -1, t,
              0, 1, t,
              0, -1, -t,
              0, 1, -t,
              t, 0, -1,
              t, 0, 1,
              -t, 0, -1,
              -t, 0, 1
              ];

    const is = [
              0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
              1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
              3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
              4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1
              ];

    for(i = 0; i < is.length; ++i){
        indices.push(is[i] + vtxs.length/3);
    }

    for(i = 0; i < vs.length; i += 3){
        vtxs.push(c.x + radius/r0*vs[i  ]);
        vtxs.push(c.y + radius/r0*vs[i+1]);
        vtxs.push(c.z + radius/r0*vs[i+2]);
    }
}

for(key in planes){
    var plane = planes[key];
    var c = ArrToVec(plane.center);
    var a = ArrToVec(plane.across).multiplyScalar(plane.nwires*plane.pitch/2.);
    var d = ArrToVec(plane.normal).multiplyScalar(plane.nticks*Math.abs(plane.tick_pitch)/2.); // drift direction

    c.add(d); // center of the drift direction too

    com.add(c);
    nplanes += 1; // javascript is silly and doesn't have any good size() method

    if(plane.view == 0){
        uperp = ArrToVec(plane.across).cross(ArrToVec(plane.normal));
    }
    if(plane.view == 1){
        vperp = ArrToVec(plane.across).cross(ArrToVec(plane.normal));
    }

    vtxs = [];
    push_square_vtxs(c, a, d, vtxs);

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vtxs), 3));

    var edges = new THREE.EdgesGeometry( geom );
    var line = new THREE.LineSegments( edges, mat_lin );

    outlines.add(line);

    line.layers.set(plane.view);

    let uvlayer = -1;
    if(plane.view != 2){
        if(a.z/a.y > 0) uvlayer = 3; else uvlayer = 4;
    }

    for(dw of [plane.digs, plane.wires]){
        if(dw == undefined) continue; // sometimes wires are missing
        for(block of dw.blocks){
            // TODO - would want to combine all the ones with the same texture
            // file into a single geometry.
            var geom = new THREE.BufferGeometry();

            var blockc = ArrToVec(plane.center);
            blockc.add(d); // center of the drift direction too
            blockc.addScaledVector(ArrToVec(plane.across), (block.dx+32-plane.nwires/2)*plane.pitch);
            blockc.addScaledVector(ArrToVec(plane.normal), (block.dy+32-plane.nticks/2)*Math.abs(plane.tick_pitch));

            // TODO hardcoding in (half) block size isn't good
            var blocka = ArrToVec(plane.across).multiplyScalar(32*plane.pitch);
            var blockd = ArrToVec(plane.normal).multiplyScalar(32*Math.abs(plane.tick_pitch));

            vtxs = [];
            push_square_vtxs(blockc, blocka, blockd, vtxs);
            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vtxs), 3));

            // TODO ditto here
            var u0 =   (block.texdx   )/block.texdim;
            var v0 = 1-(block.texdy   )/block.texdim;
            var u1 =   (block.texdx+64)/block.texdim;
            var v1 = 1-(block.texdy+64)/block.texdim;

            var uvs = new Float32Array( [u1, v0,
                                         u1, v1,
                                         u0, v1,

                                         u1, v0,
                                         u0, v1,
                                         u0, v0] );

            geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

            var mat = TextureMaterial(block.fname, block.texdim);
            var dmesh = new THREE.Mesh(geom, mat);
            dmesh.layers.set(plane.view);
            if(dw === plane.digs) digs.add(dmesh); else wires.add(dmesh);

            if(plane.view != 2) dmesh.layers.enable(uvlayer);
        }
    }

    var hitgeom = new THREE.BufferGeometry();
    var hitvtxs = [];

    for(let hit of plane.hits){
        var hc = c.clone();
        hc.addScaledVector(a, (2.*hit.wire+1)/plane.nwires-1);
        hc.addScaledVector(d, (2.*hit.tick+1)/plane.nticks-1);

        var du = ArrToVec(plane.across).multiplyScalar(plane.pitch*.45);
        var dv = ArrToVec(plane.normal).multiplyScalar(hit.rms*Math.abs(plane.tick_pitch));

        push_square_vtxs(hc, du, dv, hitvtxs);
    }

    hitgeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(hitvtxs), 3));

    var h = new THREE.Mesh(hitgeom, mat_hit);
    h.layers.set(plane.view);
    hits.add(h);

    if(plane.view != 2){
        line.layers.enable(uvlayer);
        h.layers.enable(uvlayer);
    }
}

com.divideScalar(nplanes);

spvtxs = [];
spidxs = [];
var isp = 0;
for(let sp of coords){
    push_icosahedron_vtxs(ArrToVec(sp), .4, spvtxs, spidxs);
}

var spgeom = new THREE.BufferGeometry();
spgeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(spvtxs), 3));
spgeom.setIndex(new THREE.BufferAttribute(new Uint16Array(spidxs), 1));
var sps = new THREE.Mesh(spgeom, mat_sps);
for(var i = 0; i < 5; ++i) sps.layers.enable(i);
scene.add(sps);


colors = ['red', 'blue', 'green', 'orange', 'purple', 'skyblue'];

function add_tracks(trajs, group){
    var i = 0;
    for(let track of trajs){
        col = colors[i%colors.length];
        i += 1;
        var mat_trk = new THREE.LineBasicMaterial({color: col, linewidth: 2});
        var trkgeom = new THREE.BufferGeometry();
        ptarr = [];
        for(let pt of track) ptarr = ptarr.concat(pt);
        trkgeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ptarr), 3));

        var trkline = new THREE.Line(trkgeom, mat_trk);
        trkline.layers.enable(0); trkline.layers.enable(1); trkline.layers.enable(2); trkline.layers.enable(3); trkline.layers.enable(4);
        group.add(trkline);
    }
}

add_tracks(tracks, reco_tracks);
add_tracks(truth_trajs, truth);

var controls = new THREE.OrbitControls( camera, renderer.domElement );

controls.target = com;

camera.translateX(1000);
camera.lookAt(com);

//controls.autoRotate = true;
//controls.autoRotateSpeed *= 10;

controls.update();

var animReentrant = false;

function animate() {
    if(animReentrant) return;
    animReentrant = true;

    var now = performance.now(); // can be passed as an argument, but only for requestAnimationFrame callbacks
    if(animStart != null){
        var frac = (now-animStart)/1000.; // 1sec anim
        if(frac > 1){
            frac = 1;
            animStart = null;
        }

        animFunc(frac);
    }

    renderer.render( scene, camera );

    if(animStart != null) requestAnimationFrame(animate);

    animReentrant = false;
}

function SetVisibility(col, state, id, str)
{
    col.visible = state;
    // Tick and Cross emojis respectively
    document.getElementById(id).innerHTML = (state ? '&#x2705 ' : '&#x274c ')+str;
}

function Toggle(col, id, str){
    SetVisibility(col, !col.visible, id, str);
    requestAnimationFrame(animate);
}

function ToggleRawDigits(){Toggle(digs, 'rawdigits', 'RawDigits');}
function ToggleWires(){Toggle(wires, 'wires', 'Wires');}
function ToggleHits(){Toggle(hits, 'hits', 'Hits');}
function ToggleSpacePoints(){Toggle(sps, 'spacepoints', 'SpacePoints');}
function ToggleTracks(){Toggle(reco_tracks, 'tracks', 'Tracks');}
function ToggleTruth(){Toggle(truth, 'truth', 'Truth');}

AllViews();
ThreeDControls();

// Try to pre-load all textures - doesn't work
//renderer.compile(scene, camera);

SetVisibility(digs, false, 'rawdigits', 'RawDigits');
SetVisibility(wires, false, 'wires', 'Wires');
SetVisibility(hits, false, 'hits', 'Hits');
SetVisibility(reco_tracks, false, 'tracks', 'Tracks');
SetVisibility(truth, true, 'truth', 'Truth');
SetVisibility(sps, false, 'spacepoints', 'SpacePoints');

var animStart = null;

function ZView(){camera.layers.set(2); requestAnimationFrame(animate);}
function UView(){camera.layers.set(0); requestAnimationFrame(animate);}
function VView(){camera.layers.set(1); requestAnimationFrame(animate);}

function UVView(){camera.layers.set(3); requestAnimationFrame(animate);}
function VUView(){camera.layers.set(4); requestAnimationFrame(animate);}

function AllViews(){
    camera.layers.enable(0); camera.layers.enable(1); camera.layers.enable(2);
}

function ThreeDView(){
    AllViews();

    // A hack to make sure the Z->3D transition doesn't end up completely
    // degenerate for the camera (which leads to a strange 90 degree flip).
    var targetDiff = camera.position.clone();
    targetDiff.sub(controls.target);
    targetDiff.normalize();
    targetDiff.addScaledVector(camera.up, -1e-3);
    targetDiff.normalize();

    AnimateTo(targetDiff, new THREE.Vector3(0, 1, 0), 50, null);

    ThreeDControls();
}

// https://en.wikipedia.org/wiki/Slerp#Geometric_Slerp
// p0 and p1 must be unit vectors
function slerp(p0, p1, t){
    var omega = Math.acos(THREE.Math.clamp(p0.dot(p1), -1, +1));
    if(omega == 0) return p0.clone();

    var ret = p0.clone();
    ret.multiplyScalar(Math.sin((1-t)*omega)/Math.sin(omega));
    ret.addScaledVector(p1, Math.sin(t*omega)/Math.sin(omega));
    return ret;
}

function lerpVec(v0, v1, t){
    return new THREE.Vector3(THREE.Math.lerp(v0.x, v1.x, t),
                             THREE.Math.lerp(v0.y, v1.y, t),
                             THREE.Math.lerp(v0.z, v1.z, t));
}

function UpdateFOV(cam, newFOV)
{
    var diff = cam.position.clone();
    diff.sub(controls.target);
    diff.multiplyScalar(cam.fov/newFOV);
    diff.add(controls.target);
    cam.position.copy(diff);

    cam.near *= cam.fov/newFOV;
    cam.far *= cam.fov/newFOV;
    cam.fov = newFOV;
    cam.updateProjectionMatrix();
}

function AnimateTo(targetDiff, targetUp, targetFOV, endFunc){
    var initDiff = camera.position.clone();
    initDiff.sub(controls.target);
    initDiff.normalize();

    var initFOV = camera.fov;
    var initUp = camera.up.clone();

    console.log('Animate from ', initDiff, initUp, initFOV, ' to ', targetDiff, targetUp, targetFOV);

    // May be no need to animate
    if((targetDiff == null || targetDiff.equals(initDiff)) &&
       (targetUp == null || targetUp.equals(initUp)) &&
       (targetFOV == null || targetFOV == initFOV)){
        console.log('Requested animation is a no-op, skip');
        if(endFunc != null) endFunc();
        return;
    }

    animStart = performance.now();
    animFunc = function(frac){
        if(targetDiff != null){
            var mag = camera.position.distanceTo(controls.target);
            camera.position.copy(controls.target);
            camera.position.addScaledVector(slerp(initDiff, targetDiff, frac), mag);
        }

        if(targetUp != null) camera.up = slerp(initUp, targetUp, frac);

        if(targetFOV != null) UpdateFOV(camera, THREE.Math.lerp(initFOV, targetFOV, frac));

        // console.log('Anim: ', frac, camera.position, camera.up, camera.fov);

        if(frac == 1 && endFunc != null) endFunc();

        controls.update();
    }

    requestAnimationFrame(animate);
}

function TwoDControls(){
    controls.screenSpacePanning = true;

    controls.enableRotate = false;

    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: null
    }

    // Seems to hang the touch controls entirely :(
    //controls.touches = {
    //    ONE: THREE.TOUCH.DOLLY_PAN,
    //    TWO: THREE.TOUCH.ROTATE
    //}

    controls.update();
}

function ThreeDControls(){
    controls.screenSpacePanning = true;

    controls.enableRotate = true;

    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    }

    controls.update();
}

function ZView2D(){
    camera.layers.enable(2);
    AnimateTo(new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(1, 0, 0),
              1e-6, ZView);
    TwoDControls();
}

function UVView2D(){
    camera.layers.enable(3);
    AnimateTo(vperp, new THREE.Vector3(1, 0, 0), 1e-6, UVView);
    TwoDControls();
}

function VUView2D(){
    camera.layers.enable(4);
    AnimateTo(uperp, new THREE.Vector3(1, 0, 0), 1e-6, VUView);
    TwoDControls();
}

function Perspective()
{
    AnimateTo(null, null, 50, null);
}

function Ortho()
{
    AnimateTo(null, null, 1e-6, null);
}

function Theme(theme)
{
    document.body.className = theme;

    // Doesn't work
    // renderer.setClearColor(window.getComputedStyle(document.body, null).getPropertyValue('backgroundColor'));

    if(theme == 'darktheme') renderer.setClearColor('black'); else renderer.setClearColor('white');

    requestAnimationFrame(animate);
}

window.addEventListener( 'resize', onWindowResize, false );

function onWindowResize() {
    renderer.setSize( window.innerWidth, window.innerHeight-4);

    // Keep aspect ratio correct
    camera.top = -512*window.innerHeight/window.innerWidth;
    camera.bottom = +512*window.innerHeight/window.innerWidth;

    // For 3D camera
    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();
}

window.addEventListener('unload', function(event){renderer.dispose();});

controls.addEventListener('change', animate);
window.addEventListener('resize', animate);

animate();

console.log(renderer.info);
