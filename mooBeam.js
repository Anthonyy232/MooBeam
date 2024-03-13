import {defs, tiny} from './examples/common.js';
import { Shape_From_File } from './examples/obj-file-demo.js';
const score_html = document.querySelector('#score')
const time_html = document.querySelector('#timer')
//potentially add a boolean to display "move to start game"

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Texture, Material, Scene,
} = tiny;

const {
    Textured_Phong, Fake_Bump_Map, Square, Cube, Rounded_Closed_Cone
} = defs

class Player {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.velocity = {x: 0, y: 0, z: 0};
        this.acceleration = {x: 0.03, y: 0, z: 0.03};
        this.max_speed = 0.75;
    }
}

class Skyscraper {
    constructor(transformation, x, y ,z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.transformation = transformation;
    }
}

class Cow {
    constructor(transformation, x, y ,z, animate, local_time) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.transformation = transformation;
        this.animate = animate;
        this.local_time = local_time;
        this.angle = 0;
    }
}

class Road {
    constructor(transformation, material) {
        this.transformation = transformation;
        this.material = material;
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
            lamp: new Shape_From_File("assets/lamp.obj"),
            sky: new defs.Subdivision_Sphere(4),
            floor: new Square(),
            road: new Square(),
            road_long: new Square(),
            skyscraper: new Cube(),
            beam: new Rounded_Closed_Cone(2, 20, [[0, 5], [0, 1]]),
            shadow: new defs.Regular_2D_Polygon(2, 20)
        };
        this.shapes.skyscraper.arrays.texture_coord.forEach(p => p.scale_by(3));

        this.starting_location = new Player(0, 20, 0)
        this.begin_game = false;
        this.end_game = false;
        this.score = 0;
        this.time = 90;
        this.show_beam = false;
        this.beaming = false;

        // Decrement the time every second
        let timer = setInterval(() => {
            if(this.time > 0 && !this.end_game) {
                --this.time;
            } else {
                clearInterval(timer);
                this.time = 0;
            }
        }, 1000);

        this.world_size = 200;
        this.sky_state = Mat4.identity().times(Mat4.scale(this.world_size, this.world_size, this.world_size));
        this.floor_state = Mat4.identity().times(Mat4.scale(this.world_size, this.world_size, this.world_size)).times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.road_state = Mat4.identity()
            .times(Mat4.translation(0, 1, 0))
            .times(Mat4.scale(5, this.world_size, this.world_size))
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.player = new Player(0, this.starting_location.y , 0);
        this.ufo_state = Mat4.identity();
        this.ufo_radius = 2;
        this.skyscraper_height = 25;
        this.skyscraper_size = 5;
        this.skyscraper_transformation = Mat4.identity()
            .times(Mat4.scale(this.skyscraper_size, this.skyscraper_height, this.skyscraper_size))
        this.skyscrapers_count = 25;
        this.skyscrapers_states = this.generateSkyscrapers(this.skyscraper_transformation);
        this.camera_angle = 0;
        this.beam_height = 10;
        this.beam_size = 5;
        this.cows_count = 30;
        this.cow_size = 2;
        this.cows_states = this.generateCows(Mat4.identity());
        this.initial_camera_location = Mat4.look_at(vec3(0, 10 + this.starting_location.y, 20), vec3(0, this.starting_location.y, 0), vec3(0, 1 + this.starting_location.y, 0));

        this.road_transformation = Mat4.identity()
            .times(Mat4.translation(-26, 0.02, 0))
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0))
            .times(Mat4.scale(10, 4, 10))
        this.road_transformation_inv = Mat4.identity()
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0))
            .times(Mat4.translation(-16, 0.02, 0))
            .times(Mat4.scale(10, 4, 10))

        // *** Materials
        this.materials = {
            light_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#FFFF00", 0.5), ambient: 0.7, diffusivity: 0.5, specularity: 0
            }),
            ufo_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.2, diffusivity: 0.5, specularity: 1,
                texture: new Texture("assets/ufo.jpg")
            }),
            shadow_material: new Material(new defs.Phong_Shader(1), {
                color: hex_color("#000000", 0.97), ambient: 0.1, diffusivity: 0, specularity: 0,
            }),
            cow_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.7, diffusivity: 0.5, specularity: 0.5,
                texture: new Texture("assets/cow.jpg")
            }),
            skybox: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/skybox.jpg")
            }),
            floor_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.4, diffusivity: 0.5, specularity: 0.5,
                texture: new Texture("assets/floor.jpg")
            }),
            road_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#ffffff"), ambient: 1, diffusivity: 1, specularity: 1
            }),
            skyscraper_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.6, diffusivity: 0.5, specularity: 1,
                texture: new Texture("assets/skyscraper.png")
            }),
            road1_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.6, diffusivity: 1, specularity: 0.9,
                texture: new Texture("assets/road_crosswalk.jpg")
            }),
            road2_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 0.6, diffusivity: 1, specularity: 0.9,
                texture: new Texture("assets/road.jpg")
            })
        }
    }
    generateSkyscrapers(skyscraper_transformation, num_skyscrapers = this.skyscrapers_count) {
        function getRandomInt(max) {
            return Math.floor(Math.random() * max);
        }

        let skyscrapers_states = [];
        for (let i = 0; i < num_skyscrapers; i++) {
            let x = 40 * getRandomInt(3);
            let z = 40 * getRandomInt(3);

            switch (getRandomInt(2)) {
                case 0:
                    x += 11;
                    break;
                case 1:
                    x += 29;
                    break;
            }
            switch (getRandomInt(2)) {
                case 0:
                    z += 11;
                    break;
                case 1:
                    z += 29;
                    break;
            }

            switch (getRandomInt(4)) {
                case 0:
                    break;
                case 1:
                    x = -x;
                    break;
                case 2:
                    z = -z;
                    break;
                case 3:
                    x = -x;
                    z = -z;
                    break;
            }

            let skyscraper_transformed = skyscraper_transformation.times(Mat4.translation(x/this.skyscraper_size, 1, z/this.skyscraper_size));
            skyscrapers_states.push(new Skyscraper(skyscraper_transformed, x, 0, z));

        }
        return skyscrapers_states;
    }
    generateCows(cow_transformation, num_cows = this.cows_count) {
        let cows_states = [];
        for(let i = 0; i < num_cows; i++) {
            let inside = true;
            let x = 0;
            let z = 0;
            while (inside) {
                x = Math.random() * 100 - 50;
                z = Math.random() * 100 - 50;
                if (!this.cowInSkyscraper(x, z)) { inside = false; }
            }
            let cow_transformed = cow_transformation.times(Mat4.translation(x, 1, z));
            cows_states.push(new Cow(cow_transformed, x, 0, z, false, 0));
        }
        return cows_states;
    }

    generateRoads() {
        let roads = []
        roads.push(
            new Road(this.road_transformation, this.materials.road1_material),
            new Road(this.road_transformation_inv, this.materials.road1_material),
        )
        return roads;
    }

    hasPlayerCollided(i) {
        if (this.skyscrapers_states) {
            let x_diff = Math.abs(this.skyscrapers_states[i].x - this.player.x);
            let z_diff = Math.abs(this.skyscrapers_states[i].z - this.player.z);

            // Check circle case for efficiency
            if (x_diff > this.skyscraper_size + this.ufo_radius || z_diff > this.skyscraper_size + this.ufo_radius) { return false; }
            // Check square case with corner
            if (x_diff <= this.skyscraper_size || z_diff <= this.skyscraper_size) { return true; }

            let distance_from_corner = (x_diff - this.skyscraper_size)**2 + (z_diff - this.skyscraper_size)**2;
            return (distance_from_corner <= this.ufo_radius**2);
        } else { return false; }
    }
    cowInSkyscraper(x, z) {
        //Slightly inaccurate, range is smaller than expected
        if (this.skyscrapers_states) {
            for (let i = 0; i < this.skyscrapers_states.length; i++) {
                let x_diff = Math.abs(this.skyscrapers_states[i].x - x);
                let z_diff = Math.abs(this.skyscrapers_states[i].z - z);

                // Check circle case for efficiency
                if (x_diff > this.skyscraper_size + this.cow_size || z_diff > this.skyscraper_size + this.cow_size) { continue; }
                // Check square case with corner
                if (x_diff <= this.skyscraper_size || z_diff <= this.skyscraper_size) { return true; }

                let distance_from_corner = (x_diff - this.skyscraper_size)**2 + (z_diff - this.skyscraper_size)**2;
                if (distance_from_corner <= this.cow_size + this.beam_size) {
                    return true;
                }
            }
            return false;
        } else { return false; }
    }

    hasEscapedBounds() { return Math.sqrt(this.player.x**2 + this.player.z**2) > this.world_size; }

    animate_cow(i, program_state) {
        let speed = 0.0008;
        let cow_time = Math.min(program_state.animation_time - this.cows_states[i].local_time, 1500);
        let angle = 0.1 * (90 * (this.cows_states[i].y / this.player.y)) * (Math.PI / 180);
        let direction = {x: this.player.x - this.cows_states[i].x, y: this.player.y - this.cows_states[i].y, z: this.player.z - this.cows_states[i].z};
        let length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        direction.x /= length;
        direction.y /= length;
        direction.z /= length;

        this.cows_states[i].transformation = this.cows_states[i].transformation
            .times(Mat4.translation(cow_time * speed * direction.x, cow_time * speed * direction.y, cow_time * speed * direction.z));
        this.cows_states[i].x += cow_time * speed * direction.x;
        this.cows_states[i].y += cow_time * speed * direction.y;
        this.cows_states[i].z += cow_time * speed * direction.z;
        if (this.cows_states[i].angle) {
            this.cows_states[i].angle = this.cows_states[i].angle - angle;
        } else { this.cows_states[i].angle = angle; }
    }

    is_animating(program_state) {
        let cows_animating = [];
        if (this.cows_states) {
            for (let i = 0; i < this.cows_states.length; i++) {
                if (this.cows_states[i].animate) {
                    cows_animating.push(i)
                }
                else {
                    this.cows_states[i].local_time = program_state.animation_time;
                }
            }
        }
        return cows_animating;
    }

    check_cow_within_shadow() {
        if (this.cows_states) {
            for (let i = 0; i < this.cows_states.length; i++) {
                let distance = (this.player.x - this.cows_states[i].x)**2 + (this.player.z - this.cows_states[i].z)**2
                if (distance <= this.cow_size + this.beam_size + 23) {
                    this.cows_states[i].animate = true;
                }
            }
        }
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
        this.key_triggered_button("Beam cows", ["b"], () => {
            if (!this.beaming) {
                this.show_beam = true;
                this.check_cow_within_shadow()
            }
            if (this.show_beam) {
                setTimeout(() => {
                    this.show_beam = false;
                    this.beaming = false;
                }, 1000);
            }
        });
        this.key_triggered_button("Turn left", [","], this.turn_left, "#6E6460");
        this.key_triggered_button("Turn right", ["."], this.turn_right, "#6E6460");
        this.key_triggered_button("Log", ["c"], () => {
            function getRandomInt(max) {
                return Math.floor(Math.random() * max);
            }
            let test = getRandomInt(10);
            console.log(getRandomInt(10));
        });

    }

    reset() {
        this.begin_game = false;
        this.end_game = false;
        this.score = 0;
        this.time = 90;
        this.player = new Player(0, this.starting_location.y , 0);
        this.ufo_state = Mat4.identity();
        this.cows_states = this.generateCows(Mat4.identity());
        this.skyscrapers_states = this.generateSkyscrapers(this.skyscraper_transformation);
        this.player.velocity = {x: 30, y: 30, z: 30};
    }

    move_forward() {
        this.begin_game = true;
        if (!this.beaming) {
            let x_comp = Math.cos(this.camera_angle);
            let z_comp = Math.sin(this.camera_angle);
            this.player.velocity.z -= this.player.acceleration.z;
            this.player.velocity.x -= this.player.acceleration.x;
            if (Math.abs(this.player.velocity.z) > this.player.max_speed) {
                this.player.velocity.z = -this.player.max_speed;
            }
            this.player.z += this.player.velocity.z * x_comp;
            this.player.x += this.player.velocity.z * z_comp;
            if (this.hasEscapedBounds()) {
                this.end_game = true;
            }
        }
    }

    move_backward() {
        this.begin_game = true;
        if (!this.beaming) {
            let x_comp = Math.cos(this.camera_angle);
            let z_comp = Math.sin(this.camera_angle);
            this.player.velocity.z += this.player.acceleration.z;
            if (Math.abs(this.player.velocity.z) > this.player.max_speed) {
                this.player.velocity.z = this.player.max_speed
            }
            this.player.z += this.player.velocity.z * x_comp;
            this.player.x += this.player.velocity.z * z_comp;
            if (this.hasEscapedBounds()) {
                this.end_game = true;
            }
        }
    }

    move_left() {
        this.begin_game = true;
        if (!this.beaming) {
            let x_comp = Math.cos(this.camera_angle);
            let z_comp = Math.sin(this.camera_angle);

            this.player.velocity.x -= this.player.acceleration.x;
            if (Math.abs(this.player.velocity.x) > this.player.max_speed) {
                this.player.velocity.x = -this.player.max_speed
            }
            this.player.x += this.player.velocity.x * x_comp;
            this.player.z -= this.player.velocity.x * z_comp;
            if (this.hasEscapedBounds()) {
                this.end_game = true;
            }
        }
    }

    move_right() {
        this.begin_game = true;
        if (!this.beaming) {
            let x_comp = Math.cos(this.camera_angle);
            let z_comp = Math.sin(this.camera_angle);

            this.player.velocity.x += this.player.acceleration.x;
            if (Math.abs(this.player.velocity.x) > this.player.max_speed) {
                this.player.velocity.x = this.player.max_speed
            }
            this.player.x += this.player.velocity.x * x_comp;
            this.player.z -= this.player.velocity.x * z_comp;
            if (this.hasEscapedBounds()) {
                this.end_game = true;
            }
        }
    }

    turn_left() {
        this.camera_angle += Math.PI / 36;
    }

    turn_right() {
        this.camera_angle -= Math.PI / 36;
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
                .times(Mat4.translation(0, 0.3 * Math.sin(time * 2), 0))
                .times(Mat4.rotation(time / 2.5, 0, 1, 0))

            let shadow_state = Mat4.identity()
                .times(Mat4.translation(this.player.x, 0.03, this.player.z))
                .times(Mat4.scale(this.beam_size, this.beam_size, this.beam_size))
                .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))

            if (true) { // For testing purposes set to false so the camera can fly around
                let third_person = Mat4.inverse(Mat4.identity()
                    .times(Mat4.translation(this.player.x, this.player.y, this.player.z))
                    .times(Mat4.rotation(this.camera_angle, 0, 1, 0))
                    .times(Mat4.translation(0, 12, 30))
                    .times(Mat4.rotation(-Math.PI / 6, 1, 0, 0))
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
            let light_color = this.show_beam ? color(1.0, 1.0, 0.5, 1) : color(0.33, 0.61, 0.50, 1)
            let light_strength = this.show_beam ? 100000 : 700
            program_state.lights = [new Light(
                Mat4.rotation(time / 300, this.player.x, this.player.y, this.player.z).times(vec4(3, 2, 10, 1)), light_color, light_strength)];

            this.shapes.ufo.draw(context, program_state, this.ufo_state, this.materials.ufo_material);
            this.shapes.sky.draw(context, program_state, this.sky_state, this.materials.skybox);
            this.shapes.floor.draw(context, program_state, this.floor_state, this.materials.floor_material);

            // Draw skyscrapper
            for (let i = 0; i < this.skyscrapers_states.length; i++) {
                this.shapes.skyscraper.draw(context, program_state, this.skyscrapers_states[i].transformation, this.materials.skyscraper_material);
                if (this.hasPlayerCollided(i)) {
                    this.end_game = true;
                }
            }

            // Draw roads
            let x_pos_road = -this.world_size + 40;
            for (let i = 0; i < 7; i++) {
                x_pos_road = x_pos_road + 40;
                this.road_state = Mat4.identity()
                    .times(Mat4.translation(x_pos_road, 0.01, 0))
                    .times(Mat4.scale(4, this.world_size, 120 ))
                    .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));

                this.shapes.road.draw(context, program_state, this.road_state, this.materials.road_material);
            }

            let z_pos_road = -this.world_size + 40;
            for (let i = 0; i < 7; i++) {
                z_pos_road = z_pos_road + 40;
                this.road_state = Mat4.identity()
                    .times(Mat4.translation(0, 0.01, z_pos_road))
                    .times(Mat4.scale(120, this.world_size, 4))
                    .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
                this.shapes.road.draw(context, program_state, this.road_state, this.materials.road_material);
            }

            let roads = this.generateRoads();
            for(let i = 0; i < roads.length; i++) {
                this.shapes.road_long.draw(context, program_state, roads[i].transformation, roads[i].material);
            }

            // Draw cows
            let cows_animating = this.is_animating(program_state)
            if (cows_animating) {
                for (let i = 0; i < cows_animating.length; i++) {
                    this.animate_cow(cows_animating[i], program_state)
                    if (this.cows_states[cows_animating[i]].y >= this.player.y - 3) {
                        this.cows_states = this.cows_states.filter(item => item !== this.cows_states[cows_animating[i]]);
                        this.score += 50;
                        this.show_beam = false;
                    }
                }
            } else {
                this.show_beam = this.beaming = false;
            }
            for (let i = 0; i < this.cows_states.length; i++) {
                this.shapes.cow.draw(context, program_state, this.cows_states[i].transformation.times(Mat4.rotation(this.cows_states[i].angle, 0, 1, 1)), this.materials.cow_material);
            }

            // Draw light beam conditionally
            if (this.show_beam) {
                let beam_state = Mat4.identity()
                    .times(Mat4.translation(this.player.x, this.player.y - this.beam_height, this.player.z))
                    .times(Mat4.scale(this.beam_size, this.beam_height, this.beam_size))
                    .times(Mat4.rotation(3 * Math.PI / 2, 1, 0, 0));
                this.shapes.beam.draw(context, program_state, beam_state, this.materials.light_material);
            } else {
                this.shapes.shadow.draw(context, program_state, shadow_state, this.materials.shadow_material);
            }
        }
    }
}