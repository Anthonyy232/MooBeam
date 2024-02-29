import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

class player {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}


export class MooBeam extends Scene {
    constructor() {
        super();
        this.player = new player(0, 0 , 0);
        this.ufo_state = Mat4.identity();
        this.shapes = {
            object: new defs.Subdivision_Sphere(1),
        };

        // *** Materials
        this.materials = {
            object_material: new Material(new defs.Phong_Shader(),
                {ambient: 0.2, diffusivity: 0.3, color: hex_color('#80FFFF'), specularity: 1}),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {
        this.key_triggered_button("View origin", ["Control", "0"], () => this.attached = () => null);
        this.new_line();
        this.key_triggered_button("Attach to object", ["Control", "1"], () => this.attached = () => this.object);
        this.key_triggered_button("Move forward", ["w"], this.move_forward);
    }

    move_forward() {
        let target = {x: this.player.x + 1, y: this.player.y + 1, z: this.player.z + 1};
        let t = 0.05;

        this.player.x += (target.x - this.player.x) * t;
        this.player.y += (target.y - this.player.y) * t;
        this.player.z += (target.z - this.player.z) * t;
    }

    display(context, program_state) {
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        const time = program_state.animation_time / 1000

        this.ufo_state = Mat4.identity()
            .times(Mat4.translation(this.player.x, this.player.y, this.player.z))
            .times(Mat4.rotation(time / 0.75, 0 , 1, 0))

        this.object = this.ufo_state;
        let desired = this.attached && this.attached() != null ?
            Mat4.inverse(this.attached().times(Mat4.translation(0,0,15))) : this.initial_camera_location;
        program_state.set_camera(desired.map((x,i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.1)));


        // The parameters of the Light are: position, color, size
        const light_position = vec4(0, 5, 2, 0);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        this.shapes.object.draw(context, program_state, this.ufo_state, this.materials.object_material);
    }
}

