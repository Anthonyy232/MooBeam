import {defs, tiny} from './examples/common.js';
import { Shape_From_File } from './examples/obj-file-demo.js';
const score_html = document.querySelector('#score')
const time_html = document.querySelector('#timer')

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Texture, Material, Scene,
} = tiny;

const {
    Textured_Phong, Fake_Bump_Map, Square, Cube, Rounded_Closed_Cone
} = defs

class Player {
    constructor(x, y, z, rx, ry, rz) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.rx = rx;
        this.ry = ry;
        this.rz = rz;
        this.velocity = {x: 0, y: 0, z: 0};
        this.acceleration = {x: 0.02, y: 0, z: 0.02};
        this.max_speed = 0.5;
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

class Building {
    constructor(transformation, x, y ,z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.transformation = transformation;
    }
}

class Cow {
    constructor(transformation, x, y ,z, animate, local_time, angle, rotAngle) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.transformation = transformation;
        this.animate = animate;
        this.local_time = local_time;
        this.angle = angle;
        this.rotAngle = rotAngle;
    }
}

function format_time(time) {
    let minutes_digits = Math.floor(time / 60);
    let seconds_digits = time % 60;
    return `${minutes_digits}:${seconds_digits.toString().padStart(2, '0')}`;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

export class MooBeam extends Scene {
    constructor() {
        super();
        this.shapes = {
            object: new defs.Subdivision_Sphere(4),
            ufo: new Shape_From_File("assets/Ufo.obj"),
            cow: new Shape_From_File("assets/cow.obj"),
            lamp: new Shape_From_File("assets/lamp.obj"),
            bench: new Shape_From_File("assets/bench.obj"),
            sky: new defs.Subdivision_Sphere(4),
            floor: new Square(),
            road: new Square(),
            skyscraper: new Cube(),
            building: new Cube(),
            beam: new Rounded_Closed_Cone(2, 20, [[0, 5], [0, 1]]),
            shadow: new defs.Regular_2D_Polygon(2, 20)
        };
        this.shapes.skyscraper.arrays.texture_coord.forEach(p => p.scale_by(3));
        this.shapes.building.arrays.texture_coord.forEach(p => p.scale_by(1));

        this.starting_location = new Player(0, 20, 0, 0, 0, 0)
        this.begin_game = false;
        this.end_game = false;
        this.score = 0;
        this.time = 90;
        this.show_beam = false;
        this.beaming = false;
        this.desired = null;
        this.up = false;
        this.down = false;
        this.left = false;
        this.right = false;
        this.camera_right = false;
        this.camera_left = false;
        this.behind_view = true;
        this.stored_angle = 0;
        this.crash = false;

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
        this.skyscraper_height = 5; // skyscraper_height = desired_skyscraper_height * 1/skyscraper_size
        this.skyscraper_size = 5;
        this.skyscraper_transformation = Mat4.identity()
            .times(Mat4.scale(this.skyscraper_size, this.skyscraper_height, this.skyscraper_size))
        this.skyscrapers_count = 85; // do not set to higher than 144
        this.skyscrapers_states = this.generateSkyscrapers(this.skyscraper_transformation);

        this.skyscrapers_heights = [];
        for (let i = 0; i < this.skyscrapers_count; i++) {
            this.skyscrapers_heights[i] = - 5 - Math.random() * 9;
        }

        this.skyscrapers_materials = [];
        for (let i = 0; i < this.skyscrapers_count; i++) {
            this.skyscrapers_materials[i] = getRandomInt(3);
        }

        this.building_height = 7.5;
        this.building_size = 4.95;
        this.building_transformation = Mat4.identity()
            .times(Mat4.scale(this.building_size, this.building_height, this.building_size))
        this.buildings_count = 85; // do not set to higher than 144
        this.buildings_states = this.generateBuildings(this.building_transformation);

        this.buildings_heights = [];
        for (let i = 0; i < this.buildings_count; i++) {
            this.buildings_heights[i] = 8 - Math.random() * 7;
        }

        this.buildings_materials = [];
        for (let i = 0; i < this.buildings_count; i++) {
            this.buildings_materials[i] = getRandomInt(2);
        }

        this.camera_angle = 0;
        this.beam_height = 10;
        this.beam_size = 5;
        this.cows_count = 100;
        this.cow_size = 2;
        this.cows_states = this.generateCows();
        this.initial_camera_location = Mat4.look_at(vec3(0, 10 + this.starting_location.y, 20), vec3(0, this.starting_location.y, 0), vec3(0, 1 + this.starting_location.y, 0));
        this.final_local_time = 0;

        // *** Materials
        this.materials = {
            light_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#FFFF00", 0.5), ambient: 0.7, diffusivity: 0.5, specularity: 0
            }),
            ufo_material: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#aeb2b8"), ambient: .4, diffusivity: 0.1, specularity: 1.5,
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
                color: hex_color("#00FF00"), ambient: 0.7, diffusivity: 0.5, specularity: 0,
                texture: new Texture("assets/floor.jpg")
            }),
            road_material: new Material(new defs.Phong_Shader(), {
                color: hex_color("#c4c4c4"), ambient: 1, diffusivity: 1, specularity: 1
            }),
            dash_material: new Material(new defs.Phong_Shader(), {
                color: hex_color("#ffffff"), ambient: 1, diffusivity: 1, specularity: 1
            }),
            skyscraper_material1: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 1, diffusivity: 1, specularity: 1,
                texture: new Texture("assets/skyscraper1.png")
            }),
            skyscraper_material2: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 1, diffusivity: 1, specularity: 1,
                texture: new Texture("assets/skyscraper2.png")
            }),
            skyscraper_material3: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"), ambient: 1, diffusivity: 1, specularity: 1,
                texture: new Texture("assets/skyscraper3.png")
            }),
            building_material1: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#36454F"), ambient: 0.6, diffusivity: 0.5, specularity: 1,
                texture: new Texture("assets/skyscraper4.png")
            }),
            building_material2: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#36454F"), ambient: 0.6, diffusivity: 0.5, specularity: 1,
                texture: new Texture("assets/skyscraper5.png")
            })
        }
    }


    generateSkyscrapers(skyscraper_transformation, num_skyscrapers = this.skyscrapers_count) {
        function getRandomInt(max) {
            return Math.floor(Math.random() * max);
        }

        let skyscrapers_states = [];
        let coordinates_set = new Set();

        for (let i = 0; i < num_skyscrapers; i++) {
            let x, z;
            do {
                x = 40 * getRandomInt(3);
                z = 40 * getRandomInt(3);

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
            } while (coordinates_set.has(`${x},${z}`));

            coordinates_set.add(`${x},${z}`);

            let skyscraper_transformed = skyscraper_transformation.times(Mat4.translation(x/this.skyscraper_size, 1, z/this.skyscraper_size));
            skyscrapers_states.push(new Skyscraper(skyscraper_transformed, x, 0, z));
        }
        return skyscrapers_states;
    }


    generateBuildings(building_transformation, num_buildings = this.buildings_count) {
        function getRandomInt(max) {
            return Math.floor(Math.random() * max);
        }

        let buildings_states = [];
        let coordinates_set = new Set();

        for (let i = 0; i < num_buildings; i++) {
            let x, z;
            do {
                x = 40 * getRandomInt(3);
                z = 40 * getRandomInt(3);

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
            } while (coordinates_set.has(`${x},${z}`));

            coordinates_set.add(`${x},${z}`);

            let building_transformed = building_transformation.times(Mat4.translation(x/this.building_size, 1, z/this.building_size));
            buildings_states.push(new Building(building_transformed, x, 0, z));
        }
        return buildings_states;
    }

    generateCows(num_cows = this.cows_count) {
        let cows_states = [];
        for(let i = 0; i < num_cows; i++) {
            let inside = true;
            let x = 0;
            let z = 0;
            let rotAngle = Math.random() * (2 * Math.PI);
            while (inside) {
                x = Math.random() * 200 - 100;
                z = Math.random() * 200 - 100;
                if (!this.cowInSkyscraper(x, z)) { inside = false; }
                if (!this.cowInBuilding(x, z)) { inside = false; }
            }
            let cow_transformed = Mat4.identity()
                .times(Mat4.translation(x, 1, z))
                .times(Mat4.rotation(rotAngle, 0, 1, 0));
            cows_states.push(new Cow(cow_transformed, x, 0, z, false, 0, 0, rotAngle));
        }
        return cows_states;
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

    cowInBuilding(x, z) {
        //Slightly inaccurate, range is smaller than expected
        if (this.buildings_states) {
            for (let i = 0; i < this.buildings_states.length; i++) {
                let x_diff = Math.abs(this.buildings_states[i].x - x);
                let z_diff = Math.abs(this.buildings_states[i].z - z);

                // Check circle case for efficiency
                if (x_diff > this.building_size + this.cow_size || z_diff > this.building_size + this.cow_size) { continue; }
                // Check square case with corner
                if (x_diff <= this.building_size || z_diff <= this.building_size) { return true; }

                let distance_from_corner = (x_diff - this.building_size)**2 + (z_diff - this.building_size)**2;
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

    animate_ufo_crash(program_state) {
        let local_time = program_state.animation_time/1000 - this.final_local_time;
        //console.log(local_time);

        //animation broken down in chronological order
        if (local_time > 0 && local_time <= 0.2) {
            //this.ufo_state = this.ufo_state.times(Mat4.rotation(0.07, 1, 1,0))
        }
        if (local_time > 0.0 && local_time < 1) {
            //this.ufo_state = this.ufo_state.times(Mat4.translation(0, 0.04, 0))
            this.ufo_state = this.ufo_state.times(Mat4.rotation(0.3, 0.5, 1,0))
            //this.ufo_state = this.ufo_state.times(Mat4.rotation(0.1, 1, 0,0))

        }
        if (local_time >= 1 && local_time < 10 ) {
            //this.ufo_state = this.ufo_state.times(Mat4.translation(0, -0.1*local_time**2+5 , 0))
            this.ufo_state = Mat4.identity().times(Mat4.translation(this.player.x, this.player.y, this.player.z))
                .times(Mat4.translation(0, -2*(local_time*2.2-4)**2+2 , 0))
                .times(Mat4.rotation(local_time*6, 0,1 , 0))
                .times(Mat4.rotation(0.5, 1,0 , 0))

        }
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
        document.addEventListener('click', (event) => {
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
        this.key_triggered_button("Top View", ["Control", "0"], () => {
            this.behind_view = false;
            this.camera_angle = 0;
        });
        this.key_triggered_button("Behind View", ["Control", "1"], () => {
            this.behind_view = true;
            this.camera_angle = this.stored_angle;
        });
        this.key_triggered_button("Reset game", ["r"], this.reset);
        this.new_line();
        this.new_line();
        this.key_triggered_button("Move forward", ["w"], this.move_forward, "#6E6460", () => {
            this.player.velocity.x = 0;
            this.player.velocity.z = 0;
            this.up = false;
        });
        this.key_triggered_button("Move backward", ["s"], this.move_backward, "#6E6460", () => {
            this.player.velocity.x = 0;
            this.player.velocity.z = 0;
            this.down = false;
        });
        this.key_triggered_button("Move left", ["a"], this.move_left, "#6E6460", () => {
            this.player.velocity.x = 0;
            this.player.velocity.z = 0;
            this.left = false;
        });
        this.key_triggered_button("Move right", ["d"], this.move_right, "#6E6460", () => {
            this.player.velocity.x = 0;
            this.player.velocity.z = 0;
            this.right = false;
        });
        this.new_line();
        this.new_line();
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
        this.key_triggered_button("Beam Cows", ["click"], () => {
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
        this.key_triggered_button("Beam Cows", [" "], () => {
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
        this.new_line();
        this.new_line();
        this.key_triggered_button("Turn left", ["ArrowLeft"], this.turn_left, "#6E6460", () => {
            this.camera_right = false;
            this.camera_left = false;
        });
        this.key_triggered_button("Turn left", [","], this.turn_left, "#6E6460", () => {
            this.camera_right = false;
            this.camera_left = false;
        });
        this.new_line();
        this.new_line();
        this.key_triggered_button("Turn right", ["ArrowRight"], this.turn_right, "#6E6460", () => {
            this.camera_right = false;
            this.camera_left = false;
        });
        this.key_triggered_button("Turn right", ["."], this.turn_right, "#6E6460", () => {
            this.camera_right = false;
            this.camera_left = false;
        });
    }

    reset() {
        this.begin_game = false;
        this.end_game = false;
        this.score = 0;
        this.time = 90;
        this.player = new Player(0, this.starting_location.y , 0);
        this.ufo_state = Mat4.identity();
        this.cows_states = this.generateCows();
        this.skyscrapers_states = this.generateSkyscrapers(this.skyscraper_transformation);
        this.buildings_states = this.generateBuildings(this.building_transformation);
        this.player.velocity = {x: 30, y: 30, z: 30};
        this.children.clear();
        this.up = false;
        this.down = false;
        this.left = false;
        this.right = false;
        this.camera_right = false;
        this.camera_left = false;
        this.behind_view = true;
        this.stored_angle = 0;
        this.crash = false;
    }

    move_forward() {
        this.begin_game = true;
        if (!this.beaming && !this.end_game) {
            this.up = true;
            this.player.velocity.z -= this.player.acceleration.z;
            if (Math.abs(this.player.velocity.z) > this.player.max_speed) {
                this.player.velocity.z = -this.player.max_speed;
            }
            if (this.hasEscapedBounds()) {
                this.end_game = true;
            }
        }
    }

    move_backward() {
        this.begin_game = true;
        if (!this.beaming && !this.end_game) {
            this.down = true;
            this.player.velocity.z += this.player.acceleration.z;
            if (Math.abs(this.player.velocity.z) > this.player.max_speed) {
                this.player.velocity.z = this.player.max_speed
            }
            if (this.hasEscapedBounds()) {
                this.end_game = true;
            }
        }
    }

    move_left() {
        this.begin_game = true;
        if (!this.beaming && !this.end_game) {
            this.left = true;
            this.player.velocity.x -= this.player.acceleration.x;
            if (Math.abs(this.player.velocity.x) > this.player.max_speed) {
                this.player.velocity.x = -this.player.max_speed
            }
            if (this.hasEscapedBounds()) {
                this.end_game = true;
            }
        }
    }

    move_right() {
        this.begin_game = true;
        if (!this.beaming && !this.end_game) {
            this.right = true;
            this.player.velocity.x += this.player.acceleration.x;
            if (Math.abs(this.player.velocity.x) > this.player.max_speed) {
                this.player.velocity.x = this.player.max_speed
            }
            if (this.hasEscapedBounds()) {
                this.end_game = true;
            }
        }
    }

    turn_left() {
        if (!this.beaming && !this.end_game) {
            this.camera_right = false;
            this.camera_left = true;
        }
    }

    turn_right() {
        if (!this.beaming && !this.end_game) {
            this.camera_right = true;
            this.camera_left = false;
        }
    }

    display(context, program_state) {
        // Refresh the score and timer HTML elements
        score_html.innerHTML = this.score.toString();
        time_html.innerHTML = format_time(this.time);

        if (!this.begin_game) {
            program_state.set_camera(this.initial_camera_location);
        }
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        const time = program_state.animation_time / 1000

        if (this.end_game) {
            this.behind_view = false;
            this.animate_ufo_crash(program_state);
        } else
        {
            if (this.behind_view) {
                this.stored_angle = this.camera_angle
            }
            if (this.camera_left && this.behind_view) {
                this.camera_angle += (Math.PI / 36) * 0.5;
            }
            if (this.camera_right && this.behind_view) {
                this.camera_angle -= (Math.PI / 36) * 0.5;
            }
            let x_comp = Math.cos(this.camera_angle);
            let z_comp = Math.sin(this.camera_angle);
            if (!this.beaming && !this.show_beam && !this.end_game) {
                if (this.left || this.right) {
                    this.player.x += this.player.velocity.x * x_comp;
                    this.player.z -= this.player.velocity.x * z_comp;
                }
                if (this.up || this.down) {
                    this.player.z += this.player.velocity.z * x_comp;
                    this.player.x += this.player.velocity.z * z_comp;
                }
            }

            this.final_local_time = time;
            this.ufo_state = Mat4.identity()
                .times(Mat4.translation(this.player.x, this.player.y, this.player.z))
                .times(Mat4.translation(0, 0.3 * Math.sin(time * 2), 0))
                .times(Mat4.rotation(time / 2.5, 0, 1, 0))
        }

        let shadow_state = Mat4.identity()
            .times(Mat4.translation(this.player.x, 0.03, this.player.z))
            .times(Mat4.scale(this.beam_size, this.beam_size, this.beam_size))
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0))

        if (true) { // For testing purposes set to false so the camera can fly around
            let behind = Mat4.inverse(Mat4.identity()
                .times(Mat4.translation(this.player.x, this.player.y, this.player.z))
                .times(Mat4.rotation(this.camera_angle, 0, 1, 0))
                .times(Mat4.translation(0, 12, 30))
                .times(Mat4.rotation(-Math.PI / 6, 1, 0, 0))
            )
            let top = Mat4.inverse(Mat4.identity()
                .times(Mat4.translation(this.player.x, this.player.y+60, this.player.z))
                .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            );

            this.desired = this.behind_view ? behind : top
            program_state.set_camera(this.desired);
        }

        // The parameters of the Light are: position, color, size
        let light_color = this.show_beam ? color(1.0, 1.0, 0.5, 1) : color(0.33, 0.61, 0.50, 1)
        let light_strength = this.show_beam ? 100000 : 700

        let light_position = Mat4.identity()
            .times(Mat4.rotation(time / 300, 1, 0, 0))
            .times(Mat4.translation(this.player.x, this.player.y, this.player.z))
            .times(vec4(3, 2, 10, 1));

        program_state.lights = [new Light(light_position, light_color, light_strength)];


        this.shapes.ufo.draw(context, program_state, this.ufo_state, this.materials.ufo_material);
        this.shapes.sky.draw(context, program_state, this.sky_state, this.materials.skybox);
        this.shapes.floor.draw(context, program_state, this.floor_state, this.materials.floor_material);

        // Draw skyscrapper
        for (let i = 0; i < this.skyscrapers_states.length; i++) {
            this.skyscrapers_states[i].transformation[1][3] = this.skyscrapers_heights[i];
            for (let j = 0; j < this.skyscraper_height - 2; j++) {
                this.skyscrapers_states[i].transformation[1][3] += this.skyscraper_height + 5;
                switch (this.skyscrapers_materials[i]) {
                    case 0:
                        this.shapes.skyscraper.draw(context, program_state, this.skyscrapers_states[i].transformation, this.materials.skyscraper_material1);
                        break;
                    case 1:
                        this.shapes.skyscraper.draw(context, program_state, this.skyscrapers_states[i].transformation, this.materials.skyscraper_material2);
                        break;
                    case 2:
                        this.shapes.skyscraper.draw(context, program_state, this.skyscrapers_states[i].transformation, this.materials.skyscraper_material3);
                        break;
                }
            }
            if (this.hasPlayerCollided(i)) {
                this.crash = true;
                this.end_game = true;
            }
        }

        // Draw buildings
        for (let i = 0; i < this.buildings_states.length; i++) {
            this.buildings_states[i].transformation[1][3] = this.buildings_heights[i];
            switch (this.buildings_materials[i]) {
                case 0:
                    this.shapes.building.draw(context, program_state, this.buildings_states[i].transformation, this.materials.building_material1);
                    break;
                case 1:
                    this.shapes.building.draw(context, program_state, this.buildings_states[i].transformation, this.materials.building_material2);
                    break;
            this.shapes.building.draw(context, program_state, this.buildings_states[i].transformation, this.materials.building_material);
            if (this.hasPlayerCollided(i)) {
                this.crash = true;
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

            let dash_pos = -120 + 1.4; // -4.5 + 3.1
            for (let k = 0; k < 6; k++) {
                this.road_state = Mat4.identity()
                    .times(Mat4.translation(x_pos_road + 3.5, 0.02, dash_pos + 18.5))
                    .times(Mat4.scale(.075, this.world_size, 16.5 ))
                    .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));

                this.shapes.road.draw(context, program_state, this.road_state, this.materials.dash_material);

                this.road_state = Mat4.identity()
                    .times(Mat4.translation(x_pos_road - 3.5, 0.02, dash_pos + 18.5))
                    .times(Mat4.scale(.075, this.world_size, 16.5 ))
                    .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));

                this.shapes.road.draw(context, program_state, this.road_state, this.materials.dash_material);

                for (let j = 0; j < 11; j++ ) {
                    dash_pos += 3.1;
                    this.road_state = Mat4.identity()
                        .times(Mat4.translation(x_pos_road, 0.02, dash_pos))
                        .times(Mat4.scale(.2, this.world_size, .5 ))
                        .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));

                    this.shapes.road.draw(context, program_state, this.road_state, this.materials.dash_material);
                }

                dash_pos += 5.9;
            }

        }

        let z_pos_road = -this.world_size + 40;
        for (let i = 0; i < 7; i++) {
            z_pos_road = z_pos_road + 40;
            this.road_state = Mat4.identity()
                .times(Mat4.translation(0, 0.01, z_pos_road))
                .times(Mat4.scale(120, this.world_size, 4))
                .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
            this.shapes.road.draw(context, program_state, this.road_state, this.materials.road_material);

            let dash_pos = -120 + 1.4; // -4.5 + 3.1
            for (let k = 0; k < 6; k++) {
                this.road_state = Mat4.identity()
                    .times(Mat4.translation(dash_pos + 18.5, 0.02, z_pos_road + 3.5))
                    .times(Mat4.scale(16.5, this.world_size, 0.075 ))
                    .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));

                this.shapes.road.draw(context, program_state, this.road_state, this.materials.dash_material);

                this.road_state = Mat4.identity()
                    .times(Mat4.translation(dash_pos + 18.5, 0.02, z_pos_road - 3.5))
                    .times(Mat4.scale(16.5, this.world_size, 0.075 ))
                    .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));

                this.shapes.road.draw(context, program_state, this.road_state, this.materials.dash_material);

                for (let j = 0; j < 11; j++ ) {
                    dash_pos += 3.1;
                    this.road_state = Mat4.identity()
                        .times(Mat4.translation(dash_pos, 0.02, z_pos_road))
                        .times(Mat4.scale(.5, this.world_size, .2 ))
                        .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));

                    this.shapes.road.draw(context, program_state, this.road_state, this.materials.dash_material);
                }
                dash_pos += 5.9;
            }
        }

        // corners of road
        this.road_state = Mat4.identity().times(Mat4.translation(-122, .01, -122)).times(Mat4.scale(2, this.world_size, 2 )).times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.road.draw(context, program_state, this.road_state, this.materials.road_material);

        this.road_state = Mat4.identity().times(Mat4.translation(122, .01, -122)).times(Mat4.scale(2, this.world_size, 2 )).times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.road.draw(context, program_state, this.road_state, this.materials.road_material);

        this.road_state = Mat4.identity().times(Mat4.translation(-122, .01, 122)).times(Mat4.scale(2, this.world_size, 2 )).times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.road.draw(context, program_state, this.road_state, this.materials.road_material);

        this.road_state = Mat4.identity().times(Mat4.translation(122, .01, 122)).times(Mat4.scale(2, this.world_size, 2 )).times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.road.draw(context, program_state, this.road_state, this.materials.road_material);

        // borders for edges
        this.road_state = Mat4.identity()
            .times(Mat4.translation(-123.5, 0.02, 0))
            .times(Mat4.scale(0.075, this.world_size, 123.5 ))
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.road.draw(context, program_state, this.road_state, this.materials.dash_material);

        this.road_state = Mat4.identity()
            .times(Mat4.translation(123.5, 0.02, 0))
            .times(Mat4.scale(0.075, this.world_size, 123.5 ))
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.road.draw(context, program_state, this.road_state, this.materials.dash_material);

        this.road_state = Mat4.identity()
            .times(Mat4.translation(0, 0.02, -123.5))
            .times(Mat4.scale(123.5, this.world_size, 0.075 ))
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.road.draw(context, program_state, this.road_state, this.materials.dash_material);

        this.road_state = Mat4.identity()
            .times(Mat4.translation(0, 0.02, 123.5))
            .times(Mat4.scale(123.5, this.world_size, 0.075 ))
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.road.draw(context, program_state, this.road_state, this.materials.dash_material);

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
            if (this.cows_states[i].angle === 0) {
                this.shapes.cow.draw(context, program_state, this.cows_states[i].transformation, this.materials.cow_material);
            } else {
                let transformation = Mat4.identity()
                    .times(Mat4.translation(this.cows_states[i].x, this.cows_states[i].y, this.cows_states[i].z))
                    .times(Mat4.rotation(-this.cows_states[i].rotAngle, 0, 1, 0))
                    .times(Mat4.rotation(this.cows_states[i].angle, 0, 1, 0));
                this.shapes.cow.draw(context, program_state, transformation, this.materials.cow_material);
            }
        }

        // Draw light beam conditionally
        if (this.show_beam) {
            let beam_state = Mat4.identity()
                .times(Mat4.translation(this.player.x, this.player.y - this.beam_height, this.player.z))
                .times(Mat4.scale(this.beam_size, this.beam_height, this.beam_size))
                .times(Mat4.rotation(3 * Math.PI / 2, 1, 0, 0));
            this.shapes.beam.draw(context, program_state, beam_state, this.materials.light_material);
        } else if (!this.end_game) {
            this.shapes.shadow.draw(context, program_state, shadow_state, this.materials.shadow_material);
        }
    }
}