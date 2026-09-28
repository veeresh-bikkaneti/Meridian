import { disk } from "./geo.ts";
import type { LonLat, Place } from "./types.ts";

const O_LAT = 40.81367;
const BLOCK_LAT = 0.0014025;
const LON_15 = -96.69972;
const BLOCK_LON = 0.001408;

function intersection(street: number, blocksFromO: number): LonLat {
  return [LON_15 + (street - 15) * BLOCK_LON, O_LAT + blocksFromO * BLOCK_LAT];
}

function point(lon: number, lat: number): Place["shape"] {
  return { kind: "point", coordinates: [lon, lat] };
}

function poly(coordinates: LonLat[]): Place["shape"] {
  return { kind: "polygon", coordinates };
}

const src = (label: string, href: string) => ({ label, href });

export const PLACES: Place[] = [
  {
    id: "capitol",
    name: "Nebraska State Capitol",
    ring: "lincoln",
    difficulty: 1,
    reveal: [-96.69972, 40.80806],
    shape: point(-96.69972, 40.80806),
    story:
      "The tower on 15th Street was finished in 1932 and still houses Nebraska's one-house legislature. The limestone shaft rises about 400 feet, with the Sower at the top.",
    source: src("Nebraska Capitol", "https://capitol.nebraska.gov/"),
  },
  {
    id: "memorial-stadium",
    name: "Memorial Stadium",
    ring: "lincoln",
    difficulty: 1,
    reveal: [-96.70556, 40.82056],
    shape: point(-96.70556, 40.82056),
    story:
      "The Cornhuskers have played here since 1923. The stadium sits on the north edge of city campus and is named for Nebraskans lost in war.",
    source: src("Huskers", "https://en.wikipedia.org/wiki/Memorial_Stadium_(Lincoln)"),
  },
  {
    id: "haymarket",
    name: "Haymarket",
    ring: "lincoln",
    difficulty: 1,
    reveal: [-96.71099, 40.81493],
    shape: poly(disk(-96.71099, 40.81493, 0.28)),
    story:
      "West of downtown, the old warehouse district took its name from the public market that once filled these blocks. Brick buildings now hold shops, the Railyard, and the arena's front door.",
    source: src("Lincoln Haymarket", "https://en.wikipedia.org/wiki/Haymarket_(Lincoln,_Nebraska)"),
  },
  {
    id: "pinnacle",
    name: "Pinnacle Bank Arena",
    ring: "lincoln",
    difficulty: 2,
    reveal: [-96.71253, 40.81786],
    shape: point(-96.71253, 40.81786),
    story:
      "The city's main indoor arena opened in 2013 on the west edge of the Haymarket. Basketball, concerts, and graduation ceremonies all land in the same bowl.",
    source: src("Pinnacle Bank Arena", "https://www.pinnaclebankarena.com/"),
  },
  {
    id: "27th-and-o",
    name: "27th and O",
    ring: "lincoln",
    difficulty: 2,
    reveal: intersection(27, 0),
    shape: point(...intersection(27, 0)),
    story:
      "O Street is Lincoln's east-west baseline, and 27th is one of the numbered arteries that climb as you go east. The crossing is a plain grid lesson: letters one way, numbers the other.",
    source: src("City of Lincoln", "https://www.lincoln.ne.gov/"),
  },
  {
    id: "centennial-mall",
    name: "Centennial Mall",
    ring: "lincoln",
    difficulty: 2,
    reveal: [-96.69968, 40.81548],
    shape: point(-96.69968, 40.81548),
    story:
      "A pedestrian mall runs north from the Capitol toward the university, rebuilt for the state's 150th anniversary. Fountains and plaques mark the walk between government and campus.",
    source: src("Nebraska Capitol", "https://capitol.nebraska.gov/"),
  },
  {
    id: "sunken-gardens",
    name: "Sunken Gardens",
    ring: "lincoln",
    difficulty: 2,
    reveal: [-96.68325, 40.8021],
    shape: point(-96.68325, 40.8021),
    story:
      "Terraced flower beds drop below the surrounding streets in Antelope Park. The garden has been a public showpiece since the 1930s and is still one of the city's most visited parks.",
    source: src("Lincoln Parks", "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"),
  },
  {
    id: "childrens-zoo",
    name: "Lincoln Children's Zoo",
    ring: "lincoln",
    difficulty: 2,
    reveal: [-96.68012, 40.80047],
    shape: point(-96.68012, 40.80047),
    story:
      "The zoo sits beside Antelope Creek, south of downtown, and keeps its animals close enough for children to watch. It grew from a small park zoo into the city's main animal collection.",
    source: src("Lincoln Children's Zoo", "https://www.lincolnzoo.org/"),
  },
  {
    id: "48th-and-o",
    name: "48th and O",
    ring: "lincoln",
    difficulty: 3,
    reveal: intersection(48, 0),
    shape: point(...intersection(48, 0)),
    story:
      "Forty-eighth is a major north-south street well east of downtown. Where it meets O, the grid is the whole clue: count the numbers, then find the letter that splits north from south.",
    source: src("City of Lincoln", "https://www.lincoln.ne.gov/"),
  },
  {
    id: "holmes-lake",
    name: "Holmes Lake",
    ring: "lincoln",
    difficulty: 3,
    reveal: [-96.6331, 40.7819],
    shape: poly([
      [-96.641, 40.787],
      [-96.624, 40.788],
      [-96.619, 40.78],
      [-96.627, 40.7795],
      [-96.64, 40.7792],
      [-96.644, 40.782],
      [-96.641, 40.787],
    ]),
    story:
      "The lake in southeast Lincoln was built as a flood-control reservoir and became a park with a trail, a golf course, and Hyde Observatory on the south shore.",
    source: src("USGS GNIS", "https://edits.nationalmap.gov/apps/gaz-domestic/public/search/names"),
  },
  {
    id: "pioneers-park",
    name: "Pioneers Park",
    ring: "lincoln",
    difficulty: 3,
    reveal: [-96.77321, 40.77573],
    shape: poly([
      [-96.802, 40.789],
      [-96.748, 40.791],
      [-96.744, 40.758],
      [-96.79, 40.752],
      [-96.808, 40.772],
      [-96.802, 40.789],
    ]),
    story:
      "A large city park fills the southwest edge of Lincoln with prairie, woods, and a nature center. Bison and elk live in the enclosed range along the park's west side.",
    source: src("Lincoln Parks", "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"),
  },
  {
    id: "wilderness-park",
    name: "Wilderness Park",
    ring: "lincoln",
    difficulty: 3,
    reveal: [-96.72427, 40.78616],
    shape: poly([
      [-96.742, 40.8],
      [-96.708, 40.798],
      [-96.7, 40.74],
      [-96.728, 40.722],
      [-96.752, 40.755],
      [-96.742, 40.8],
    ]),
    story:
      "A long, narrow park follows Salt Creek on the south side of the city. Trails run through cottonwoods for miles, more corridor than lawn.",
    source: src("Lincoln Parks", "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"),
  },
  {
    id: "antelope-park",
    name: "Antelope Park",
    ring: "lincoln",
    difficulty: 3,
    reveal: [-96.6794, 40.79488],
    shape: poly(disk(-96.6794, 40.79488, 0.45)),
    story:
      "The park follows Antelope Creek south of downtown, linking neighborhoods to the Sunken Gardens and the zoo. It is a green thread rather than a single field.",
    source: src("Lincoln Parks", "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"),
  },
  {
    id: "oak-lake",
    name: "Oak Lake Park",
    ring: "lincoln",
    difficulty: 3,
    reveal: [-96.71634, 40.8307],
    shape: poly(disk(-96.71634, 40.8307, 0.35)),
    story:
      "A small lake and park sit northwest of downtown, near the rail lines and the airport approach. It is an older recreation spot, not a downtown lawn.",
    source: src("Lincoln Parks", "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"),
  },
  {
    id: "wyuka",
    name: "Wyuka Cemetery",
    ring: "lincoln",
    difficulty: 3,
    reveal: [-96.66453, 40.81767],
    shape: poly(disk(-96.66453, 40.81767, 0.4)),
    story:
      "Wyuka is a historic garden cemetery east of downtown, laid out in the rural-cemetery tradition with curving drives and mature trees. It has served Lincoln since the 19th century.",
    source: src("Wyuka Cemetery", "https://en.wikipedia.org/wiki/Wyuka_Cemetery"),
  },
  {
    id: "lincoln-airport",
    name: "Lincoln Airport",
    ring: "lincoln",
    difficulty: 3,
    reveal: [-96.75744, 40.84731],
    shape: point(-96.75744, 40.84731),
    story:
      "The city's airport is northwest of downtown, on the prairie side of Oak Creek. Commercial flights share the field with Air National Guard operations.",
    source: src("Lincoln Airport", "https://en.wikipedia.org/wiki/Lincoln_Airport_(Nebraska)"),
  },
  {
    id: "union-plaza",
    name: "Union Plaza",
    ring: "lincoln",
    difficulty: 3,
    reveal: [-96.69025, 40.81656],
    shape: point(-96.69025, 40.81656),
    story:
      "A plaza and splash pad occupy the block where rail yards once divided downtown from the university. It is a newer public room on the walk toward campus.",
    source: src("City of Lincoln", "https://www.lincoln.ne.gov/"),
  },
  {
    id: "gateway",
    name: "Gateway Mall",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.63575, 40.8161],
    shape: point(-96.63575, 40.8161),
    story:
      "The indoor mall on the east side of Lincoln, near O Street, was the edge-of-town shopping center for a generation. The surrounding blocks are now a retail district of their own.",
    source: src("City of Lincoln", "https://www.lincoln.ne.gov/"),
  },
  {
    id: "southpointe",
    name: "SouthPointe Pavilions",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.67765, 40.7419],
    shape: point(-96.67765, 40.7419),
    story:
      "A retail center anchors the far south of Lincoln, well below the lettered grid. It marks how the city grew toward the county line in the late 20th century.",
    source: src("City of Lincoln", "https://www.lincoln.ne.gov/"),
  },
  {
    id: "havelock",
    name: "Havelock",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.62434, 40.85571],
    shape: poly(disk(-96.62434, 40.85571, 0.9)),
    story:
      "Havelock was a railroad town northeast of Lincoln before annexation. The old main street still reads as its own neighborhood, with the historic shopfronts near the Burlington shops.",
    source: src("City of Lincoln", "https://www.lincoln.ne.gov/"),
  },
  {
    id: "college-view",
    name: "College View",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.65331, 40.76813],
    shape: poly(disk(-96.65331, 40.76813, 0.7)),
    story:
      "College View grew around Union College in southeast Lincoln. The neighborhood kept its name after it joined the city, and the campus is still its center of gravity.",
    source: src("Union College", "https://www.ucollege.edu/"),
  },
  {
    id: "university-place",
    name: "University Place",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.64793, 40.83831],
    shape: poly(disk(-96.64793, 40.83831, 0.7)),
    story:
      "University Place was a streetcar suburb built around Nebraska Wesleyan. The campus and the old commercial corner are still the heart of the neighborhood.",
    source: src("Nebraska Wesleyan", "https://www.nebrwesleyan.edu/"),
  },
  {
    id: "near-south",
    name: "Near South",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.69287, 40.79853],
    shape: poly([
      [-96.71, 40.8035],
      [-96.672, 40.8035],
      [-96.672, 40.786],
      [-96.71, 40.786],
      [-96.71, 40.8035],
    ]),
    story:
      "Near South is the neighborhood immediately south of downtown, a grid of older houses between the Capitol and the parks along Antelope Creek. Residents usually just say the name of the nearest lettered street.",
    source: src("City of Lincoln", "https://www.lincoln.ne.gov/"),
  },
  {
    id: "hyde",
    name: "Hyde Observatory",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.63623, 40.77787],
    shape: point(-96.63623, 40.77787),
    story:
      "A public observatory stands on the south shore of Holmes Lake. Local astronomers open the dome for night programs, a quiet landmark beside the water.",
    source: src("Hyde Observatory", "https://en.wikipedia.org/wiki/Holmes_Lake_(Nebraska)"),
  },
  {
    id: "robbers-cave",
    name: "Robber's Cave",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.70765, 40.77999],
    shape: point(-96.70765, 40.77999),
    story:
      "Sandstone caves dug into a south Lincoln bluff became a local legend, often tied to outlaw stories that historians treat with care. The site is a real hollow in the rock, story optional.",
    source: src("City of Lincoln", "https://www.lincoln.ne.gov/"),
  },
  {
    id: "star-city-shores",
    name: "Star City Shores",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.68023, 40.76864],
    shape: point(-96.68023, 40.76864),
    story:
      "Lincoln's water park takes the city's Star City nickname. It sits in the south part of town, a summer landmark more than a historic one.",
    source: src("Lincoln Parks", "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"),
  },
  {
    id: "quilt-museum",
    name: "International Quilt Museum",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.67357, 40.82832],
    shape: point(-96.67357, 40.82832),
    story:
      "The International Quilt Museum, on East Campus, holds a large public collection of quilts from many countries. The building's glass galleries are a landmark on their own.",
    source: src("International Quilt Museum", "https://www.internationalquiltmuseum.org/"),
  },
  {
    id: "woods-park",
    name: "Woods Park",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.67923, 40.80739],
    shape: poly(disk(-96.67923, 40.80739, 0.22)),
    story:
      "A neighborhood park east of the Capitol, Woods is a local green rather than a citywide destination. Tennis courts and shade trees fill most of the block.",
    source: src("Lincoln Parks", "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"),
  },
  {
    id: "conestoga",
    name: "Conestoga Lake",
    ring: "lincoln",
    difficulty: 4,
    reveal: [-96.85118, 40.76566],
    shape: poly(disk(-96.85118, 40.76566, 0.7)),
    story:
      "Conestoga is a flood-control lake southwest of the city, just inside the wider Lincoln map. The state recreation area wraps the water with a trail and a boat ramp.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "branched-oak",
    name: "Branched Oak Lake",
    ring: "region",
    difficulty: 2,
    reveal: [-96.87593, 40.97329],
    shape: poly(disk(-96.87593, 40.97329, 2.1)),
    story:
      "The largest of the Salt Valley lakes sits northwest of Lincoln. It was built for flood control and is now the region's main sailing and swimming water.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "mahoney",
    name: "Eugene T. Mahoney State Park",
    ring: "region",
    difficulty: 2,
    reveal: [-96.31313, 41.02671],
    shape: point(-96.31313, 41.02671),
    story:
      "Mahoney is the full-service state park between Lincoln and Omaha, with a lodge, a pool, and trails above the Platte. Families treat it as the nearest overnight park.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "sac-museum",
    name: "Strategic Air Command & Aerospace Museum",
    ring: "region",
    difficulty: 2,
    reveal: [-96.32, 41.018],
    shape: point(-96.32, 41.018),
    story:
      "The aerospace museum near Ashland displays bombers and missiles from the Strategic Air Command era. It stands beside the interstate, impossible to miss once you know the silhouette.",
    source: src("SAC Aerospace Museum", "https://sacmuseum.org/"),
  },
  {
    id: "seward",
    name: "Seward",
    ring: "region",
    difficulty: 2,
    reveal: [-97.17067, 40.86955],
    shape: point(-97.17067, 40.86955),
    story:
      "Seward is the county seat west of Lincoln, known locally for its Fourth of July festival. The courthouse square is the classic small-city target.",
    source: src("City of Seward", "https://en.wikipedia.org/wiki/Seward,_Nebraska"),
  },
  {
    id: "homestead",
    name: "Homestead National Historical Park",
    ring: "region",
    difficulty: 2,
    reveal: [-96.82194, 40.28528],
    shape: point(-96.82194, 40.28528),
    story:
      "The park near Beatrice marks the site of one of the first claims under the 1862 Homestead Act. A tallgrass prairie and the Palmer-Epard cabin tell the story of settlement.",
    source: src("National Park Service", "https://www.nps.gov/home/"),
  },
  {
    id: "pawnee-lake",
    name: "Pawnee Lake",
    ring: "region",
    difficulty: 3,
    reveal: [-96.289, 40.99843],
    shape: poly(disk(-96.289, 40.99843, 1.3)),
    story:
      "Pawnee is another Salt Valley reservoir, northwest of Ashland and east of Lincoln. Anglers and campers use the arms of the lake through the summer.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "platte-river-sp",
    name: "Platte River State Park",
    ring: "region",
    difficulty: 3,
    reveal: [-96.22375, 40.99278],
    shape: point(-96.22375, 40.99278),
    story:
      "The park climbs the bluffs on the south side of the Platte, east of Lincoln. Cabins and trails look over the river valley toward the Omaha side.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "ashland",
    name: "Ashland",
    ring: "region",
    difficulty: 3,
    reveal: [-96.36839, 41.03917],
    shape: point(-96.36839, 41.03917),
    story:
      "Ashland is a small city on the northwest road toward Omaha, just off the Platte. It is the town you pass when the lakes and Mahoney start to appear.",
    source: src("City of Ashland", "https://en.wikipedia.org/wiki/Ashland,_Nebraska"),
  },
  {
    id: "wahoo",
    name: "Wahoo",
    ring: "region",
    difficulty: 3,
    reveal: [-96.6198, 41.21111],
    shape: point(-96.6198, 41.21111),
    story:
      "Wahoo is the Saunders County seat north of Lincoln. The courthouse square is the center of town, and the place is proud of a long main street rather than a single monument.",
    source: src("City of Wahoo", "https://en.wikipedia.org/wiki/Wahoo,_Nebraska"),
  },
  {
    id: "wagon-train",
    name: "Wagon Train Lake",
    ring: "region",
    difficulty: 3,
    reveal: [-96.58503, 40.63191],
    shape: poly(disk(-96.58503, 40.63191, 0.85)),
    story:
      "Wagon Train is a reservoir south of Lincoln, part of the same flood-control chain as the lakes closer to town. The recreation area is a weekend drive down Highway 77.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "spring-creek",
    name: "Spring Creek Prairie",
    ring: "region",
    difficulty: 3,
    reveal: [-96.84759, 40.68664],
    shape: point(-96.84759, 40.68664),
    story:
      "Audubon's Spring Creek Prairie preserves tallgrass southwest of Lincoln. Trails cross remnant prairie that once covered this part of the state.",
    source: src("Audubon", "https://en.wikipedia.org/wiki/Spring_Creek_Prairie"),
  },
  {
    id: "arbor-lodge",
    name: "Arbor Lodge",
    ring: "region",
    difficulty: 3,
    reveal: [-95.88158, 40.68047],
    shape: point(-95.88158, 40.68047),
    story:
      "Arbor Lodge in Nebraska City was the estate of J. Sterling Morton, founder of Arbor Day. The mansion and its arboretum face the Missouri River bluffs.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "beatrice",
    name: "Beatrice",
    ring: "region",
    difficulty: 3,
    reveal: [-96.74737, 40.26643],
    shape: point(-96.74737, 40.26643),
    story:
      "Beatrice is the Gage County seat on the Big Blue River, south of Lincoln. The downtown courthouse square is the place most people mean when they name the town.",
    source: src("City of Beatrice", "https://en.wikipedia.org/wiki/Beatrice,_Nebraska"),
  },
  {
    id: "stagecoach",
    name: "Stagecoach Lake",
    ring: "region",
    difficulty: 4,
    reveal: [-96.64107, 40.60126],
    shape: poly(disk(-96.64107, 40.60126, 0.55)),
    story:
      "Stagecoach is one of the smaller Salt Valley lakes, south of Lincoln near the highway to Kansas. It is an easier miss than Branched Oak and a quieter shore.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "grand-island",
    name: "Grand Island",
    ring: "nebraska",
    difficulty: 1,
    reveal: [-98.35861, 40.92167],
    shape: point(-98.35861, 40.92167),
    story:
      "Grand Island is the regional city in the Platte valley, west of Lincoln along the interstate. The downtown and the county courthouse sit near the middle of the urban area.",
    source: src("City of Grand Island", "https://en.wikipedia.org/wiki/Grand_Island,_Nebraska"),
  },
  {
    id: "henry-doorly",
    name: "Henry Doorly Zoo",
    ring: "nebraska",
    difficulty: 1,
    reveal: [-95.92673, 41.22547],
    shape: point(-95.92673, 41.22547),
    story:
      "Omaha's zoo, south of downtown, is known for its desert dome, aquarium, and large animal exhibits. It is one of the state's most visited places.",
    source: src("Henry Doorly Zoo", "https://www.omahazoo.com/"),
  },
  {
    id: "old-market",
    name: "Old Market",
    ring: "nebraska",
    difficulty: 1,
    reveal: [-95.9319, 41.25494],
    shape: poly(disk(-95.9319, 41.25494, 0.25)),
    story:
      "Omaha's Old Market is a warehouse district turned dining and arts quarter, just east of the modern downtown towers. The brick streets are the part people mean.",
    source: src("Visit Omaha", "https://www.visitomaha.com/"),
  },
  {
    id: "chimney-rock",
    name: "Chimney Rock",
    ring: "nebraska",
    difficulty: 2,
    reveal: [-103.34833, 41.70361],
    shape: point(-103.34833, 41.70361),
    story:
      "The spire in western Nebraska was the landmark Oregon Trail emigrants watched for days. It still stands above the North Platte valley near Bayard.",
    source: src("National Park Service", "https://www.nps.gov/chro/"),
  },
  {
    id: "scotts-bluff",
    name: "Scotts Bluff",
    ring: "nebraska",
    difficulty: 2,
    reveal: [-103.70722, 41.83472],
    shape: point(-103.70722, 41.83472),
    story:
      "A massive clay and sandstone bluff rises over the North Platte near Gering. Wagon trains used the pass at its foot, and a road now climbs to the summit.",
    source: src("National Park Service", "https://www.nps.gov/scbl/"),
  },
  {
    id: "archway",
    name: "The Archway",
    ring: "nebraska",
    difficulty: 2,
    reveal: [-99.03852, 40.67011],
    shape: point(-99.03852, 40.67011),
    story:
      "A museum shaped like a covered bridge spans Interstate 80 at Kearney. It tells the story of trails and roads across the Platte valley, from wagons to the highway underneath.",
    source: src("The Archway", "https://en.wikipedia.org/wiki/Great_Platte_River_Road_Archway_Monument"),
  },
  {
    id: "durham",
    name: "Durham Museum",
    ring: "nebraska",
    difficulty: 2,
    reveal: [-95.9281, 41.2514],
    shape: point(-95.9281, 41.2514),
    story:
      "Omaha's Union Station, a 1931 Art Deco railroad palace, is now the Durham Museum. The great hall still feels like a station even though the trains are gone.",
    source: src("The Durham Museum", "https://durhammuseum.org/"),
  },
  {
    id: "carhenge",
    name: "Carhenge",
    ring: "nebraska",
    difficulty: 3,
    reveal: [-102.85799, 42.14229],
    shape: point(-102.85799, 42.14229),
    story:
      "A ring of gray-painted cars stands in a field north of Alliance, arranged like Stonehenge. It began as a family memorial and became one of the state's best-known roadside works.",
    source: src("Carhenge", "https://www.carhenge.com/"),
  },
  {
    id: "kingsley",
    name: "Kingsley Dam",
    ring: "nebraska",
    difficulty: 3,
    reveal: [-101.80405, 41.25011],
    shape: point(-101.80405, 41.25011),
    story:
      "Kingsley Dam holds back Lake McConaughy, the big reservoir on the North Platte. The dam itself, not the far shoreline, is the point to find.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "smith-falls",
    name: "Smith Falls",
    ring: "nebraska",
    difficulty: 3,
    reveal: [-100.31499, 42.88878],
    shape: point(-100.31499, 42.88878),
    story:
      "Nebraska's tallest waterfall drops over a bluff into the Niobrara River. A footbridge crosses the river to the base of the falls in the state park.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "fort-robinson",
    name: "Fort Robinson",
    ring: "nebraska",
    difficulty: 3,
    reveal: [-103.4689, 42.66883],
    shape: point(-103.4689, 42.66883),
    story:
      "The old army post in northwest Nebraska is now a state park of barracks, stables, and parade ground. It is also the site of Crazy Horse's death in 1877.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "valentine",
    name: "Valentine",
    ring: "nebraska",
    difficulty: 3,
    reveal: [-100.55062, 42.87468],
    shape: point(-100.55062, 42.87468),
    story:
      "Valentine is the town on the edge of the Sandhills and the Niobrara valley. Outfitters and the national wildlife refuge make it the north-central base camp.",
    source: src("City of Valentine", "https://en.wikipedia.org/wiki/Valentine,_Nebraska"),
  },
  {
    id: "joslyn",
    name: "Joslyn Art Museum",
    ring: "nebraska",
    difficulty: 3,
    reveal: [-95.94602, 41.26042],
    shape: point(-95.94602, 41.26042),
    story:
      "Joslyn's marble Art Deco building sits north of downtown Omaha. The museum's collection and concert hall have anchored the city's arts district for decades.",
    source: src("Joslyn Art Museum", "https://www.joslyn.org/"),
  },
  {
    id: "golden-spike",
    name: "Golden Spike Tower",
    ring: "nebraska",
    difficulty: 3,
    reveal: [-100.82939, 41.14439],
    shape: point(-100.82939, 41.14439),
    story:
      "An observation tower in North Platte looks over Bailey Yard, the Union Pacific's huge classification yard. The view is the reason the tower exists.",
    source: src("Golden Spike Tower", "https://en.wikipedia.org/wiki/Bailey_Yard"),
  },
  {
    id: "indian-cave",
    name: "Indian Cave State Park",
    ring: "nebraska",
    difficulty: 3,
    reveal: [-95.57159, 40.26208],
    shape: point(-95.57159, 40.26208),
    story:
      "The park follows the Missouri River bluffs in the southeast corner of the state. A sandstone cave with Indigenous petroglyphs gives the park its name.",
    source: src("Nebraska Game and Parks", "https://outdoornebraska.gov/"),
  },
  {
    id: "ashfall",
    name: "Ashfall Fossil Beds",
    ring: "nebraska",
    difficulty: 4,
    reveal: [-98.15861, 42.425],
    shape: point(-98.15861, 42.425),
    story:
      "A volcanic ash fall about twelve million years ago buried a waterhole full of rhinos and horses in northeast Nebraska. The fossils are still uncovered under a barn-like shelter.",
    source: src("Ashfall Fossil Beds", "https://ashfall.unl.edu/"),
  },
  {
    id: "toadstool",
    name: "Toadstool Geologic Park",
    ring: "nebraska",
    difficulty: 4,
    reveal: [-103.58288, 42.85649],
    shape: point(-103.58288, 42.85649),
    story:
      "Soft clay and caprock in the far northwest have worn into toadstool shapes. The badlands trail is one of the strangest walks in the state.",
    source: src("US Forest Service", "https://en.wikipedia.org/wiki/Toadstool_Geologic_Park"),
  },
  {
    id: "chadron",
    name: "Chadron",
    ring: "nebraska",
    difficulty: 4,
    reveal: [-103.00037, 42.83098],
    shape: point(-103.00037, 42.83098),
    story:
      "Chadron is a college town at the north end of the Pine Ridge, a long drive from Lincoln. Museum of the Fur Trade sits just east of town.",
    source: src("City of Chadron", "https://en.wikipedia.org/wiki/Chadron,_Nebraska"),
  },
  {
    id: "niobrara",
    name: "Niobrara River at Valentine",
    ring: "nebraska",
    difficulty: 4,
    reveal: [-100.13934, 42.81473],
    shape: point(-100.13934, 42.81473),
    story:
      "East of Valentine the Niobrara is a national scenic river, braided between sandstone bluffs and cold-water springs. This point sits on that protected stretch.",
    source: src("National Park Service", "https://www.nps.gov/niob/"),
  },
  {
    id: "white-house",
    name: "The White House",
    ring: "usa",
    difficulty: 1,
    reveal: [-77.03653, 38.89768],
    shape: point(-77.03653, 38.89768),
    story:
      "The president's house has stood at 1600 Pennsylvania Avenue since 1800. The limestone walls were painted white after the British burned the interior in 1814.",
    source: src("The White House", "https://www.whitehouse.gov/"),
  },
  {
    id: "golden-gate",
    name: "Golden Gate Bridge",
    ring: "usa",
    difficulty: 1,
    reveal: [-122.47826, 37.81993],
    shape: point(-122.47826, 37.81993),
    story:
      "The suspension bridge opened in 1937 across the mouth of San Francisco Bay. Its color, international orange, was chosen to be seen in fog.",
    source: src("Golden Gate Bridge", "https://www.goldengate.org/"),
  },
  {
    id: "grand-canyon",
    name: "Grand Canyon",
    ring: "usa",
    difficulty: 2,
    reveal: [-112.14011, 36.05444],
    shape: point(-112.14011, 36.05444),
    story:
      "The South Rim village looks into a gorge cut by the Colorado River, more than a mile deep in places. This point is the main visitor area, not the whole canyon.",
    source: src("National Park Service", "https://www.nps.gov/grca/"),
  },
  {
    id: "old-faithful",
    name: "Old Faithful",
    ring: "usa",
    difficulty: 2,
    reveal: [-110.82814, 44.46048],
    shape: point(-110.82814, 44.46048),
    story:
      "The geyser in Yellowstone erupts often enough that crowds plan around it. It sits in the Upper Geyser Basin, among many less predictable vents.",
    source: src("National Park Service", "https://www.nps.gov/yell/"),
  },
  {
    id: "rushmore",
    name: "Mount Rushmore",
    ring: "usa",
    difficulty: 2,
    reveal: [-103.45907, 43.8791],
    shape: point(-103.45907, 43.8791),
    story:
      "Four presidential faces were carved into a granite peak in the Black Hills between 1927 and 1941. The viewing terrace faces the sculpture from the north.",
    source: src("National Park Service", "https://www.nps.gov/moru/"),
  },
  {
    id: "gateway-arch",
    name: "Gateway Arch",
    ring: "usa",
    difficulty: 2,
    reveal: [-90.18478, 38.62469],
    shape: point(-90.18478, 38.62469),
    story:
      "Eero Saarinen's stainless arch on the St. Louis riverfront was completed in 1965. It commemorates the city's role as a starting point for westward travel.",
    source: src("Gateway Arch", "https://www.nps.gov/jeff/"),
  },
  {
    id: "french-quarter",
    name: "Jackson Square",
    ring: "usa",
    difficulty: 2,
    reveal: [-90.06296, 29.95744],
    shape: point(-90.06296, 29.95744),
    story:
      "Jackson Square is the public plaza at the heart of New Orleans' French Quarter, facing St. Louis Cathedral. The river is a short walk beyond the levee.",
    source: src("New Orleans", "https://www.neworleans.com/"),
  },
  {
    id: "space-needle",
    name: "Space Needle",
    ring: "usa",
    difficulty: 2,
    reveal: [-122.34927, 47.62051],
    shape: point(-122.34927, 47.62051),
    story:
      "The tower was built for the 1962 world's fair in Seattle. It still stands over the Seattle Center, with the observation deck near the top of the saucer.",
    source: src("Space Needle", "https://www.spaceneedle.com/"),
  },
  {
    id: "niagara",
    name: "Niagara Falls",
    ring: "usa",
    difficulty: 2,
    reveal: [-79.0742, 43.083],
    shape: point(-79.0742, 43.083),
    story:
      "The American Falls drop over a cliff on the New York side of the Niagara River. The larger Horseshoe Falls curves into Canada a short distance away.",
    source: src("Niagara Falls State Park", "https://en.wikipedia.org/wiki/Niagara_Falls"),
  },
  {
    id: "alamo",
    name: "The Alamo",
    ring: "usa",
    difficulty: 3,
    reveal: [-98.48614, 29.42597],
    shape: point(-98.48614, 29.42597),
    story:
      "The former mission church in downtown San Antonio was the site of the 1836 siege. The chapel facade is the image most people are aiming for.",
    source: src("The Alamo", "https://www.thealamo.org/"),
  },
  {
    id: "willis",
    name: "Willis Tower",
    ring: "usa",
    difficulty: 3,
    reveal: [-87.63592, 41.87888],
    shape: point(-87.63592, 41.87888),
    story:
      "The black steel tower in downtown Chicago was the world's tallest building when it opened in 1973 as the Sears Tower. The Skydeck looks out over the lake.",
    source: src("Willis Tower", "https://en.wikipedia.org/wiki/Willis_Tower"),
  },
  {
    id: "crater-lake",
    name: "Crater Lake",
    ring: "usa",
    difficulty: 3,
    reveal: [-122.1685, 42.8684],
    shape: point(-122.1685, 42.8684),
    story:
      "A collapsed volcano in southern Oregon holds a deep blue lake with no river inlet. The water comes from rain and snow, and Wizard Island rises inside the caldera.",
    source: src("National Park Service", "https://www.nps.gov/crla/"),
  },
  {
    id: "monument-valley",
    name: "Monument Valley",
    ring: "usa",
    difficulty: 3,
    reveal: [-110.0985, 36.998],
    shape: point(-110.0985, 36.998),
    story:
      "Sandstone buttes stand on the Navajo Nation along the Arizona-Utah line. The view from the visitor center is the classic one, not every spire in the valley.",
    source: src("Navajo Nation Parks", "https://en.wikipedia.org/wiki/Monument_Valley"),
  },
  {
    id: "pike-place",
    name: "Pike Place Market",
    ring: "usa",
    difficulty: 3,
    reveal: [-122.3425, 47.60972],
    shape: point(-122.3425, 47.60972),
    story:
      "The public market has run above Seattle's waterfront since 1907. The main arcade, not the whole hillside, is the spot to place.",
    source: src("Pike Place Market", "https://www.pikeplacemarket.org/"),
  },
  {
    id: "cadillac",
    name: "Cadillac Mountain",
    ring: "usa",
    difficulty: 3,
    reveal: [-68.225, 44.3526],
    shape: point(-68.225, 44.3526),
    story:
      "The granite summit in Acadia National Park is the highest point on the United States Atlantic coast. For part of the year it catches the country's first sunrise.",
    source: src("National Park Service", "https://www.nps.gov/acad/"),
  },
  {
    id: "denali",
    name: "Denali",
    ring: "usa",
    difficulty: 4,
    reveal: [-151.007, 63.069],
    shape: point(-151.007, 63.069),
    story:
      "The highest peak in North America rises from the Alaska Range. The summit, not the park entrance hours away by road, is the point.",
    source: src("National Park Service", "https://www.nps.gov/dena/"),
  },
  {
    id: "everglades",
    name: "Everglades",
    ring: "usa",
    difficulty: 4,
    reveal: [-80.5853, 25.3946],
    shape: point(-80.5853, 25.3946),
    story:
      "The River of Grass covers the southern tip of Florida. This point is the Royal Palm area of the national park, a boardwalk into the sawgrass rather than the whole watershed.",
    source: src("National Park Service", "https://www.nps.gov/ever/"),
  },
  {
    id: "death-valley",
    name: "Badwater Basin",
    ring: "usa",
    difficulty: 4,
    reveal: [-116.7672, 36.2296],
    shape: point(-116.7672, 36.2296),
    story:
      "Badwater Basin in Death Valley is the lowest point in North America, a salt flat below sea level. Summer heat here is among the highest recorded on Earth.",
    source: src("National Park Service", "https://www.nps.gov/deva/"),
  },
  {
    id: "hoover",
    name: "Hoover Dam",
    ring: "usa",
    difficulty: 4,
    reveal: [-114.73778, 36.01611],
    shape: point(-114.73778, 36.01611),
    story:
      "The concrete arch dam plugs the Colorado River between Nevada and Arizona, forming Lake Mead. It was finished in 1936 and still carries a highway across the crest.",
    source: src("Bureau of Reclamation", "https://www.usbr.gov/lc/hooverdam/"),
  },
  {
    id: "eiffel",
    name: "Eiffel Tower",
    ring: "world",
    difficulty: 1,
    reveal: [2.29448, 48.85837],
    shape: point(2.29448, 48.85837),
    story:
      "Gustave Eiffel's iron tower was built for the 1889 world's fair in Paris. It was meant to be temporary and is now the city's most familiar silhouette.",
    source: src("Eiffel Tower", "https://www.toureiffel.paris/en"),
  },
  {
    id: "colosseum",
    name: "Colosseum",
    ring: "world",
    difficulty: 1,
    reveal: [12.49223, 41.89021],
    shape: point(12.49223, 41.89021),
    story:
      "The amphitheater in central Rome opened in 80 CE. It held tens of thousands for public games and still anchors the east end of the Roman Forum.",
    source: src("Colosseum", "https://colosseo.it/en/"),
  },
  {
    id: "liberty",
    name: "Statue of Liberty",
    ring: "world",
    difficulty: 1,
    reveal: [-74.0445, 40.68925],
    shape: point(-74.0445, 40.68925),
    story:
      "The copper figure stands on Liberty Island in New York Harbor, a gift from France dedicated in 1886. The island, not the Manhattan skyline, is the target.",
    source: src("National Park Service", "https://www.nps.gov/stli/"),
  },
  {
    id: "taj",
    name: "Taj Mahal",
    ring: "world",
    difficulty: 1,
    reveal: [78.0421, 27.17501],
    shape: point(78.0421, 27.17501),
    story:
      "The marble mausoleum in Agra was built in the 17th century for Mumtaz Mahal. It sits in a formal garden on the south bank of the Yamuna.",
    source: src("Taj Mahal", "https://www.tajmahal.gov.in/"),
  },
  {
    id: "opera-house",
    name: "Sydney Opera House",
    ring: "world",
    difficulty: 2,
    reveal: [151.2153, -33.85678],
    shape: point(151.2153, -33.85678),
    story:
      "Jørn Utzon's sail-like shells stand on a point in Sydney Harbour. The building opened in 1973 after a long and difficult construction.",
    source: src("Sydney Opera House", "https://www.sydneyoperahouse.com/"),
  },
  {
    id: "redeemer",
    name: "Christ the Redeemer",
    ring: "world",
    difficulty: 2,
    reveal: [-43.21049, -22.95192],
    shape: point(-43.21049, -22.95192),
    story:
      "The concrete statue looks over Rio de Janeiro from the summit of Corcovado. It was completed in 1931 and is reached by a cog railway through the forest.",
    source: src("Christ the Redeemer", "https://en.wikipedia.org/wiki/Christ_the_Redeemer_(statue)"),
  },
  {
    id: "sagrada",
    name: "Sagrada Família",
    ring: "world",
    difficulty: 2,
    reveal: [2.17436, 41.40363],
    shape: point(2.17436, 41.40363),
    story:
      "Antoni Gaudí's basilica in Barcelona has been under construction since 1882. The towers and the organic stonework are still being finished.",
    source: src("Sagrada Família", "https://sagradafamilia.org/en/"),
  },
  {
    id: "giza",
    name: "Great Pyramid of Giza",
    ring: "world",
    difficulty: 2,
    reveal: [31.1342, 29.97917],
    shape: point(31.1342, 29.97917),
    story:
      "The largest pyramid at Giza was built for the pharaoh Khufu more than 4,500 years ago. It is the oldest of the structures people still call wonders of the world.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/86/"),
  },
  {
    id: "cn-tower",
    name: "CN Tower",
    ring: "world",
    difficulty: 2,
    reveal: [-79.38706, 43.64257],
    shape: point(-79.38706, 43.64257),
    story:
      "The communications tower in Toronto was the world's tallest free-standing structure when it opened in 1976. The main pod holds the observation decks.",
    source: src("CN Tower", "https://www.cntower.ca/"),
  },
  {
    id: "machu",
    name: "Machu Picchu",
    ring: "world",
    difficulty: 3,
    reveal: [-72.54496, -13.16307],
    shape: point(-72.54496, -13.16307),
    story:
      "The Inca estate sits on a ridge above the Urubamba River in Peru. It was built in the 15th century and became widely known again in 1911.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/274/"),
  },
  {
    id: "fuji",
    name: "Mount Fuji",
    ring: "world",
    difficulty: 3,
    reveal: [138.72736, 35.36064],
    shape: point(138.72736, 35.36064),
    story:
      "The volcano southwest of Tokyo is Japan's highest peak. The summit crater, not the lakes at the base, is the point to place.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/1418/"),
  },
  {
    id: "chichen",
    name: "Chichén Itzá",
    ring: "world",
    difficulty: 3,
    reveal: [-88.56778, 20.68429],
    shape: point(-88.56778, 20.68429),
    story:
      "The Maya city in Yucatán is famous for the stepped pyramid called El Castillo. At the equinox, the evening sun draws a serpent of light down the stair.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/483/"),
  },
  {
    id: "stonehenge",
    name: "Stonehenge",
    ring: "world",
    difficulty: 3,
    reveal: [-1.82622, 51.17888],
    shape: point(-1.82622, 51.17888),
    story:
      "The stone circle on Salisbury Plain was raised in stages beginning about 5,000 years ago. The largest stones came from a site in Wales.",
    source: src("English Heritage", "https://www.english-heritage.org.uk/visit/places/stonehenge/"),
  },
  {
    id: "neuschwanstein",
    name: "Neuschwanstein",
    ring: "world",
    difficulty: 3,
    reveal: [10.7498, 47.55757],
    shape: point(10.7498, 47.55757),
    story:
      "Ludwig II's castle in the Bavarian Alps was unfinished when he died in 1886. The pale towers above the gorge are what most people are looking for.",
    source: src("Neuschwanstein", "https://en.wikipedia.org/wiki/Neuschwanstein_Castle"),
  },
  {
    id: "angkor",
    name: "Angkor Wat",
    ring: "world",
    difficulty: 3,
    reveal: [103.86699, 13.41247],
    shape: point(103.86699, 13.41247),
    story:
      "The temple complex in Cambodia was built in the 12th century as a Hindu monument and later became a Buddhist one. Its five towers are the aim point.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/668/"),
  },
  {
    id: "petra",
    name: "Petra",
    ring: "world",
    difficulty: 4,
    reveal: [35.4518, 30.3222],
    shape: point(35.4518, 30.3222),
    story:
      "The Nabataean city in southern Jordan is entered through a narrow canyon. The Treasury facade, carved from the cliff, is the usual target.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/326/"),
  },
  {
    id: "table-mountain",
    name: "Table Mountain",
    ring: "world",
    difficulty: 4,
    reveal: [18.40975, -33.96282],
    shape: point(18.40975, -33.96282),
    story:
      "The flat-topped mountain stands over Cape Town. A cableway climbs the plateau, which is a national park above the city.",
    source: src("Table Mountain", "https://www.sanparks.org/parks/table-mountain"),
  },
  {
    id: "uluru",
    name: "Uluru",
    ring: "world",
    difficulty: 4,
    reveal: [131.03688, -25.34443],
    shape: point(131.03688, -25.34443),
    story:
      "The sandstone monolith in Australia's Northern Territory is a sacred place for the Anangu people. The rock itself, not the resort to the north, is the point.",
    source: src("Parks Australia", "https://parksaustralia.gov.au/uluru/"),
  },
  {
    id: "victoria-falls",
    name: "Victoria Falls",
    ring: "world",
    difficulty: 4,
    reveal: [25.85667, -17.9243],
    shape: point(25.85667, -17.9243),
    story:
      "The Zambezi River drops into a narrow gorge on the border of Zambia and Zimbabwe. The spray, not a wide cascade, is what you see from the rim.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/509/"),
  },
  {
    id: "fushimi",
    name: "Fushimi Inari",
    ring: "world",
    difficulty: 4,
    reveal: [135.77267, 34.96714],
    shape: point(135.77267, 34.96714),
    story:
      "Thousands of vermilion gates climb the mountain behind a shrine in southern Kyoto. The main shrine at the base of the trail is the point to place.",
    source: src("Fushimi Inari", "https://en.wikipedia.org/wiki/Fushimi_Inari-taisha"),
  },
  {
    id: "iguazu",
    name: "Iguazú Falls",
    ring: "world",
    difficulty: 4,
    reveal: [-54.43667, -25.69528],
    shape: point(-54.43667, -25.69528),
    story:
      "A chain of waterfalls spans the Iguazú River where Argentina meets Brazil. The Devil's Throat is the narrow horseshoe at the heart of the system.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/303/"),
  },
  {
    id: "tongariki",
    name: "Ahu Tongariki",
    ring: "world",
    difficulty: 5,
    reveal: [-109.27694, -27.12556],
    shape: point(-109.27694, -27.12556),
    story:
      "Fifteen moai stand on a stone platform on the southeast coast of Rapa Nui. It is the largest restored ahu on the island.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/715/"),
  },
  {
    id: "potala",
    name: "Potala Palace",
    ring: "world",
    difficulty: 5,
    reveal: [91.11694, 29.65778],
    shape: point(91.11694, 29.65778),
    story:
      "The palace rises above Lhasa on a hill that was already sacred before the present buildings. It was the winter home of the Dalai Lamas for centuries.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/707/"),
  },
  {
    id: "timbuktu",
    name: "Timbuktu",
    ring: "world",
    difficulty: 5,
    reveal: [-3.00742, 16.77348],
    shape: point(-3.00742, 16.77348),
    story:
      "The city in Mali was a hub of the trans-Saharan trade and of Islamic learning. Its mosques and manuscript libraries still mark the historic center.",
    source: src("UNESCO", "https://whc.unesco.org/en/list/119/"),
  },
  {
    id: "galapagos",
    name: "Puerto Ayora",
    ring: "world",
    difficulty: 5,
    reveal: [-90.31545, -0.74329],
    shape: point(-90.31545, -0.74329),
    story:
      "Puerto Ayora is the largest town in the Galápagos, on the south coast of Santa Cruz. The research station and the harbor are the local landmark, not the whole archipelago.",
    source: src("Galápagos", "https://en.wikipedia.org/wiki/Puerto_Ayora"),
  },
];

export const PLACES_BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((place) => [place.id, place]));

export function placesIn(ring: Place["ring"]): Place[] {
  return PLACES.filter((place) => place.ring === ring);
}
