import {defs, tiny} from './examples/common.js';
import {Axes_Viewer, Axes_Viewer_Test_Scene} from "./examples/axes-viewer.js"
import {Collision_Demo, Inertia_Demo} from "./examples/collisions-demo.js"
import {Many_Lights_Demo} from "./examples/many-lights-demo.js"
import {Obj_File_Demo} from "./examples/obj-file-demo.js"
import {Scene_To_Texture_Demo} from "./examples/scene-to-texture-demo.js"
import {Surfaces_Demo} from "./examples/surfaces-demo.js"
import {Text_Demo} from "./examples/text-demo.js"
import {Transforms_Sandbox} from "./examples/transforms-sandbox.js"
import {MooBeam} from "./mooBeam.js";

const {
    Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene,
    Canvas_Widget, Code_Widget, Text_Widget
} = tiny;

const Minimal_Webgl_Demo = defs.Minimal_Webgl_Demo;

Object.assign(defs,
    {Axes_Viewer, Axes_Viewer_Test_Scene},
    {Inertia_Demo, Collision_Demo},
    {Many_Lights_Demo},
    {Obj_File_Demo},
    {Scene_To_Texture_Demo},
    {Surfaces_Demo},
    {Text_Demo},
    {Transforms_Sandbox},
    {Assignment3: MooBeam}
);

const Main_Scene = MooBeam;
const Additional_Scenes = [];

export {Main_Scene, Additional_Scenes, Canvas_Widget, Code_Widget, Text_Widget, defs}