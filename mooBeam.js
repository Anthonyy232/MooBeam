import {defs, tiny} from './examples/common.js';
import { Shape_From_File } from './examples/obj-file-demo.js';
const score_html = document.querySelector('#score')
const time_html = document.querySelector('#timer')
//potentially add a boolean to display "move to start game"

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Texture, Material, Scene,
} = tiny;

const {
    Textured_Phong, Fake_Bump_Map, Square, Cube
} = defs

class player {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

function format_time(time) {
    let minutes_digits = Math.floor(time / 60);
    let seconds_digits = time % 60;
    return `${minutes_digits}:${seconds_digits}`;
}

export class MooBeam extends Scene {
    constructor() {
        super();
        this.shapes = {
            object: new defs.Subdivision_Sphere(4),
            ufo: new Shape_From_File("assets/Ufo.obj"),
            sky: new defs.Subdivision_Sphere(5),
            floor: new Square(),
            skyscraper: new Cube()
        };

        this.starting_location = new player(0, 20, 0)
        this.movement_speed = 100;
        this.collided = false;
        this.begin_game = false;
        this.end_game = false;
        this.score = 0;
        this.time = 90;

        // Decrement the time every second
        let timer = setInterval(() => {
            //supposed to check this.begin_game && !this.collided too but couldn't get it working for some reason, the move_*() functions set this.begin_game to true, but it doesn't see it
            if(this.time > 0) {
                --this.time;
            } else {
                this.end_game = true;
                clearInterval(timer);
            }
        }, 1000);


        this.world_size = 200;
        this.sky_state = Mat4.identity().times(Mat4.scale(this.world_size, this.world_size, this.world_size));
        this.floor_state = Mat4.identity().times(Mat4.scale(this.world_size, this.world_size, this.world_size)).times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.player = new player(0, this.starting_location.y , 0);
        this.ufo_state = Mat4.identity();
        this.skyscrapper_height = 25;
        this.skyscrapper_size = 10;
        this.skyscraper_state = Mat4.identity()
            .times(Mat4.scale(this.skyscrapper_size, this.skyscrapper_height, this.skyscrapper_size))
            .times(Mat4.translation(0, 1, 0)); //translate it vertically so the base is at the floor height
        this.skyscrapper_count = 30;



        // *** Materials
        this.materials = {
            ufo_material: new Material(new Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.5, diffusivity: 0.5, specularity: 1,
                texture: new Texture("assets/stars.png")
            }),
            skybox: new Material(new Textured_Phong, {
                color: hex_color("#000000"), ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/skybox.png")
            }),
            floor_material: new Material(new Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.5, diffusivity: 0, specularity: 1,
                texture: new Texture("assets/floor.jpg")
            }),
            skyscraper_material: new Material(new Fake_Bump_Map(1), {
                color: hex_color("#71706E"), ambient: 0.5, diffusivity: 0, specularity: 1
            })
        }
        this.initial_camera_location = Mat4.look_at(vec3(0, 10 + this.starting_location.y, 20), vec3(0, this.starting_location.y, 0), vec3(0, 1 + this.starting_location.y, 0));


        // Generate random skyscrapers
        this.skyscrapers_states = this.generateSkyscrapers(this.skyscraper_state);
    }

    generateSkyscrapers(skyscraper_state, num_skyscrapers = this.skyscrapper_count) {
        let skyscrapers_states = [];
        for(let i = 0; i < num_skyscrapers; i++) {
            let x = Math.random() * 100 - 50;
            let z = Math.random() * 100 - 50;

            let skyscraper_state_transformed = skyscraper_state.times(Mat4.translation(x, 0, z));
            skyscrapers_states.push(skyscraper_state_transformed);
        }
        return skyscrapers_states;
    }

    make_control_panel() {
        this.key_triggered_button("Isometric View", ["Control", "0"], () => this.attached = () => null);
        this.new_line();
        this.key_triggered_button("Behind View", ["Control", "1"], () => this.attached = () => this.object);
        //this.key_triggered_button("Move forward", ["w"], this.move_forward);
        //this.key_triggered_button("Move backward", ["s"], this.move_backward);
        //this.key_triggered_button("Move left", ["a"], this.move_left);
        //this.key_triggered_button("Move right", ["d"], this.move_right);
        this.key_triggered_button("Move forward", ["i"], this.move_forward);
        this.key_triggered_button("Move backward", ["k"], this.move_backward);
        this.key_triggered_button("Move left", ["j"], this.move_left);
        this.key_triggered_button("Move right", ["l"], this.move_right);
        this.key_triggered_button("Reset game", ["r"], this.reset);
    }

    reset() {
        this.collided = false;
        this.begin_game = false;
        this.end_game = false;
        this.score = 0;
        this.time = 90;
        this.player = new player(0, this.starting_location.y , 0);
        this.ufo_state = Mat4.identity();
        this.skyscrapers_states = this.generateSkyscrapers(this.skyscraper_state);
    }

    move_forward() {
        this.begin_game = true;
        //smooth motion but not smooth enough, consider transitioning to position, vel, accel style
        //need to take care of release key if doing velocity+accel
        let target = {z: this.player.z - this.movement_speed};
        let t = 0.01;
        this.player.z += (target.z - this.player.z) * t;
    }
    move_backward() {
        this.begin_game = true;
        let target = {z: this.player.z + this.movement_speed};
        let t = 0.01;
        this.player.z += (target.z - this.player.z) * t;
    }
    move_left() {
        this.begin_game = true;
        let target = {x: this.player.x - this.movement_speed};
        let t = 0.01;
        this.player.x += (target.x - this.player.x) * t;
    }
    move_right() {
        this.begin_game = true;
        let target = {x: this.player.x + this.movement_speed};
        let t = 0.01;
        this.player.x += (target.x - this.player.x) * t;
    }

    display(context, program_state) {
        // Refresh the score and timer HTML elements
        score_html.innerHTML = this.score.toString()
        time_html.innerHTML = format_time(this.time)

        // Display bottom control panel
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
        }
        if (!this.begin_game) {
            program_state.set_camera(this.initial_camera_location);
        }
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        const time = program_state.animation_time / 1000

        this.ufo_state = Mat4.identity()
            .times(Mat4.translation(this.player.x, this.player.y, this.player.z))
            //hover animation
            .times(Mat4.translation(0, 0.3*Math.sin(time*2), 0))
            .times(Mat4.rotation(time / 2.5, 0 , 1, 0))

        if (false) { // For testing purposes set to false so the camera can fly around
            let third_person = Mat4.inverse(Mat4.identity()
                .times(Mat4.translation(this.player.x, this.player.y, this.player.z))
                .times(Mat4.translation(0,5,13))
                .times(Mat4.rotation(-Math.PI / 8, 1, 0, 0 ))
            )
            let angle = Math.atan(1 / Math.sqrt(2));
            let isometric = Mat4.inverse(Mat4.identity()
                .times(Mat4.rotation(angle, 1, 0, 0))
                .times(Mat4.rotation(Math.PI / 4, 0, 1, 0))
                .times(Mat4.translation(-this.player.x, -this.player.y, -this.player.z))
            );
            this.object = this.ufo_state;
            let desired = this.attached && this.attached() != null ? third_person : this.initial_camera_location // <--set as initial until isometric works
            program_state.set_camera(desired.map((x,i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.1)));
            //^figure out how to do quaternion blending so when pressing the keys there isn't a slight camera give
        }

        // The parameters of the Light are: position, color, size
        let light_position = vec4(this.player.x, this.player.y, this.player.z, 0);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        this.shapes.ufo.draw(context, program_state, this.ufo_state, this.materials.ufo_material);
        this.shapes.sky.draw(context, program_state, this.sky_state, this.materials.skybox);
        this.shapes.floor.draw(context, program_state, this.floor_state, this.materials.floor_material);

        for(let i = 0; i < this.skyscrapers_states.length; i++) {
            this.shapes.skyscraper.draw(context, program_state, this.skyscrapers_states[i], this.materials.skyscraper_material);
        }
    }
}