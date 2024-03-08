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
        this.velocity = {x: 0, y: 0, z: 0};
        this.acceleration = {x: 0.01, y: 0, z: 0.01};
        this.max_speed = 0.1;
    }
}

function format_time(time) {
    let minutes_digits = Math.floor(time / 60);
    let seconds_digits = time % 60;
    return `${minutes_digits}:${seconds_digits.toString().padStart(2, '0')}`;
}

export class MooBeam extends Scene {
    constructor() {
        super();
        this.shapes = {
            object: new defs.Subdivision_Sphere(4),
            ufo: new Shape_From_File("assets/Ufo.obj"),
            cow: new Shape_From_File("assets/cow.obj"),
            sky: new defs.Subdivision_Sphere(5),
            floor: new Square(),
            skyscraper: new Cube()
        };

        this.starting_location = new player(0, 20, 0)
        this.cow_start = vec3(10, 2, 0);
        this.movement_speed = 100;
        this.collided = false;
        this.begin_game = false;
        this.end_game = false;
        this.score = 0;
        this.time = 90;
        this.show_beam = false;
        this.local_time = 0;
        this.animated = "false";

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
            regular: new Material(new defs.Phong_Shader(), {
                color: hex_color("#000000"), ambient: 0.2, diffusivity: 0.5, specularity: 1
            }),
            ufo_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.2, diffusivity: 0.5, specularity: 1,
                texture: new Texture("assets/ufo.jpg")
            }),
            cow_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.2, diffusivity: 0.5, specularity: 1,
                texture: new Texture("assets/ufo.jpg")
            }),
            skybox: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/skybox.png")
            }),
            floor_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.4, diffusivity: 0.5, specularity: 0.5,
                texture: new Texture("assets/floor.jpg")
            }),
            skyscraper_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.6, diffusivity: 0.5, specularity: 1,
                texture: new Texture("assets/skyscrapper.png")
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

    make_control_panel(program_state) {
        this.key_triggered_button("Isometric View", ["Control", "0"], () => this.attached = () => null);
        this.new_line();
        this.key_triggered_button("Behind View", ["Control", "1"], () => this.attached = () => this.object);

        this.key_triggered_button("Move forward", ["i"], this.move_forward, "#6E6460", () => {
            this.player.velocity.z = 0;
        });
        this.key_triggered_button("Move backward", ["k"], this.move_backward, "#6E6460", () => {
            this.player.velocity.z = 0;
        });
        this.key_triggered_button("Move left", ["j"], this.move_left, "#6E6460", () => {
            this.player.velocity.x = 0;
        });
        this.key_triggered_button("Move right", ["l"], this.move_right, "#6E6460", () => {
            this.player.velocity.x = 0;
        });
        this.key_triggered_button("Reset game", ["r"], this.reset);
        this.key_triggered_button("Beam cows", ["b"], () => this.animated = "start");

    }

    reset() {
        this.collided = false;
        this.begin_game = false;
        this.end_game = false;
        this.score = 0;
        this.time = 90;
        this.player = new player(0, this.starting_location.y , 0);
        this.ufo_state = Mat4.identity();
        this.cow_state = Mat4.identity().times(Mat4.translation(this.cow_start[0], this.cow_start[1], this.cow_start[2]));
        this.skyscrapers_states = this.generateSkyscrapers(this.skyscraper_state);
        this.player.velocity = {x: 30, y: 30, z: 30};
    }

    move_forward() {
        this.begin_game = true;
        this.player.velocity.z -= 6*this.player.acceleration.z;
        if (Math.abs(this.player.velocity.z) > this.max_speed) {
            this.player.velocity.z = -this.max_speed
        }
        this.player.z += this.player.velocity.z;
    }

    move_backward() {
        this.begin_game = true;
        this.player.velocity.z += 3*this.player.acceleration.z;
        if (Math.abs(this.player.velocity.z) > this.max_speed) {
            this.player.velocity.z = this.max_speed
        }
        this.player.z += this.player.velocity.z;
    }

    move_left() {
        this.begin_game = true;
        this.player.velocity.x -= 3*this.player.acceleration.x;
        if (Math.abs(this.player.velocity.x) > this.max_speed) {
            this.player.velocity.x = -this.max_speed
        }
        this.player.x += this.player.velocity.x;
    }
    animate_cow(start_time, program_time) {
        let working_time = program_time - start_time;
        this.stop_time;
        if (working_time < 1500) {
            this.cow_state = this.cow_state.times(Mat4.translation(0, working_time * 0.01, 0));
            this.stop_time = working_time;
        } else {
            this.cow_state = this.cow_state.times(Mat4.translation(0, this.stop_time * 0.01, 0));
        }
    }

    move_right() {
        this.begin_game = true;
        this.player.velocity.x += 3*this.player.acceleration.x;
        if (Math.abs(this.player.velocity.x) > this.max_speed) {
            this.player.velocity.x = this.max_speed
        }
        this.player.x += this.player.velocity.x;
    }
    display(context, program_state) {
        // Refresh the score and timer HTML elements
        score_html.innerHTML = this.score.toString()
        time_html.innerHTML = format_time(this.time)



        // Display bottom control panel
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
        }
        if (!this.end_game) {
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

            if (this.animated == "false") {
                this.local_time = program_state.animation_time;
            }
            else if (this.animated == "start") {
                this.animated = "on";
            }
            else {
            }

            this.cow_state = Mat4.identity()
                .times(Mat4.translation(this.cow_start[0], this.cow_start[1], this.cow_start[2]))
                //.times(Mat4.translation(10, 0,0))

            if ( this.player.y < this.cow_start[1] + 20 &&
                this.player.x < this.cow_start[0] + 3 && this.player.x > this.cow_start[0] - 3 &&
                this.player.z < this.cow_start[2] + 3 && this.player.z > this.cow_start[2] - 3) {

                this.animated = "start";
            }
            console.log(this.player);
            console.log(this.cow_start);

            this.animate_cow(this.local_time, program_state.animation_time);

            if (true) { // For testing purposes set to false so the camera can fly around
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
                program_state.set_camera(desired);
            }

            // The parameters of the Light are: position, color, size
            program_state.lights = [new Light(
                Mat4.rotation(time / 300, this.player.x, this.player.y, this.player.z).times(vec4(3, 2, 10, 1)), color(1, .7, .7, 1), 10000)];

            this.shapes.ufo.draw(context, program_state, this.ufo_state, this.materials.ufo_material);
            this.shapes.cow.draw(context, program_state, this.cow_state, this.materials.cow_material);
            this.shapes.sky.draw(context, program_state, this.sky_state, this.materials.skybox);
            this.shapes.floor.draw(context, program_state, this.floor_state, this.materials.floor_material);

            for(let i = 0; i < this.skyscrapers_states.length; i++) {
                this.shapes.skyscraper.draw(context, program_state, this.skyscrapers_states[i], this.materials.skyscraper_material);
            }
        }
    }
}