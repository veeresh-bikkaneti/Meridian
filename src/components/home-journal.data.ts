/** Field journal. One entry per catalog place. Rotates every 2 hours. */
export type JournalNote = {
  id: string;
  place: string;
  where: string;
  story: string;
  sourceLabel: string;
  sourceHref: string;
  /** Optional storybook drawing for the note (path under public/, e.g.
   *  "images/journal/taj.webp"). Notes without art render as before. */
  image?: string;
  /** One-sentence, kid-friendly description of the drawing (required
   *  whenever image is set). */
  imageAlt?: string;
};

export const JOURNAL_NOTES: JournalNote[] = [
  {
    "id": "capitol",
    "place": "Nebraska State Capitol",
    "where": "Lincoln, Nebraska",
    "story": "The tower on 15th Street was finished in 1932 and still houses Nebraska's one-house legislature. The limestone shaft rises about 400 feet, with the Sower at the top.",
    "sourceLabel": "Nebraska Capitol",
    "sourceHref": "https://capitol.nebraska.gov/"
  },
  {
    "id": "memorial-stadium",
    "place": "Memorial Stadium",
    "where": "Lincoln, Nebraska",
    "story": "The Cornhuskers have played here since 1923. The stadium sits on the north edge of city campus and is named for Nebraskans lost in war.",
    "sourceLabel": "Huskers",
    "sourceHref": "https://en.wikipedia.org/wiki/Memorial_Stadium_(Lincoln)"
  },
  {
    "id": "haymarket",
    "place": "Haymarket",
    "where": "Lincoln, Nebraska",
    "story": "West of downtown, the old warehouse district took its name from the public market that once filled these blocks. Brick buildings now hold shops, the Railyard, and the arena's front door.",
    "sourceLabel": "Lincoln Haymarket",
    "sourceHref": "https://en.wikipedia.org/wiki/Haymarket_(Lincoln,_Nebraska)"
  },
  {
    "id": "pinnacle",
    "place": "Pinnacle Bank Arena",
    "where": "Lincoln, Nebraska",
    "story": "The city's main indoor arena opened in 2013 on the west edge of the Haymarket. Basketball, concerts, and graduation ceremonies all land in the same bowl.",
    "sourceLabel": "Pinnacle Bank Arena",
    "sourceHref": "https://www.pinnaclebankarena.com/"
  },
  {
    "id": "27th-and-o",
    "place": "27th and O",
    "where": "Lincoln, Nebraska",
    "story": "O Street is Lincoln's east-west baseline, and 27th is one of the numbered arteries that climb as you go east. The crossing is a plain grid lesson: letters one way, numbers the other.",
    "sourceLabel": "City of Lincoln",
    "sourceHref": "https://www.lincoln.ne.gov/"
  },
  {
    "id": "centennial-mall",
    "place": "Centennial Mall",
    "where": "Lincoln, Nebraska",
    "story": "A pedestrian mall runs north from the Capitol toward the university, rebuilt for the state's 150th anniversary. Fountains and plaques mark the walk between government and campus.",
    "sourceLabel": "Nebraska Capitol",
    "sourceHref": "https://capitol.nebraska.gov/"
  },
  {
    "id": "sunken-gardens",
    "place": "Sunken Gardens",
    "where": "Lincoln, Nebraska",
    "story": "Terraced flower beds drop below the surrounding streets in Antelope Park. The garden has been a public showpiece since the 1930s and is still one of the city's most visited parks.",
    "sourceLabel": "Lincoln Parks",
    "sourceHref": "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"
  },
  {
    "id": "childrens-zoo",
    "place": "Lincoln Children's Zoo",
    "where": "Lincoln, Nebraska",
    "story": "The zoo sits beside Antelope Creek, south of downtown, and keeps its animals close enough for children to watch. It grew from a small park zoo into the city's main animal collection.",
    "sourceLabel": "Lincoln Children's Zoo",
    "sourceHref": "https://www.lincolnzoo.org/"
  },
  {
    "id": "48th-and-o",
    "place": "48th and O",
    "where": "Lincoln, Nebraska",
    "story": "Forty-eighth is a major north-south street well east of downtown. Where it meets O, the grid is the whole clue: count the numbers, then find the letter that splits north from south.",
    "sourceLabel": "City of Lincoln",
    "sourceHref": "https://www.lincoln.ne.gov/"
  },
  {
    "id": "holmes-lake",
    "place": "Holmes Lake",
    "where": "Lincoln, Nebraska",
    "story": "The lake in southeast Lincoln was built as a flood-control reservoir and became a park with a trail, a golf course, and Hyde Observatory on the south shore.",
    "sourceLabel": "USGS GNIS",
    "sourceHref": "https://edits.nationalmap.gov/apps/gaz-domestic/public/search/names"
  },
  {
    "id": "pioneers-park",
    "place": "Pioneers Park",
    "where": "Lincoln, Nebraska",
    "story": "A large city park fills the southwest edge of Lincoln with prairie, woods, and a nature center. Bison and elk live in the enclosed range along the park's west side.",
    "sourceLabel": "Lincoln Parks",
    "sourceHref": "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"
  },
  {
    "id": "wilderness-park",
    "place": "Wilderness Park",
    "where": "Lincoln, Nebraska",
    "story": "A long, narrow park follows Salt Creek on the south side of the city. Trails run through cottonwoods for miles, more corridor than lawn.",
    "sourceLabel": "Lincoln Parks",
    "sourceHref": "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"
  },
  {
    "id": "antelope-park",
    "place": "Antelope Park",
    "where": "Lincoln, Nebraska",
    "story": "The park follows Antelope Creek south of downtown, linking neighborhoods to the Sunken Gardens and the zoo. It is a green thread rather than a single field.",
    "sourceLabel": "Lincoln Parks",
    "sourceHref": "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"
  },
  {
    "id": "oak-lake",
    "place": "Oak Lake Park",
    "where": "Lincoln, Nebraska",
    "story": "A small lake and park sit northwest of downtown, near the rail lines and the airport approach. It is an older recreation spot, not a downtown lawn.",
    "sourceLabel": "Lincoln Parks",
    "sourceHref": "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"
  },
  {
    "id": "wyuka",
    "place": "Wyuka Cemetery",
    "where": "Lincoln, Nebraska",
    "story": "Wyuka is a historic garden cemetery east of downtown, laid out in the rural-cemetery tradition with curving drives and mature trees. It has served Lincoln since the 19th century.",
    "sourceLabel": "Wyuka Cemetery",
    "sourceHref": "https://en.wikipedia.org/wiki/Wyuka_Cemetery"
  },
  {
    "id": "lincoln-airport",
    "place": "Lincoln Airport",
    "where": "Lincoln, Nebraska",
    "story": "The city's airport is northwest of downtown, on the prairie side of Oak Creek. Commercial flights share the field with Air National Guard operations.",
    "sourceLabel": "Lincoln Airport",
    "sourceHref": "https://en.wikipedia.org/wiki/Lincoln_Airport_(Nebraska)"
  },
  {
    "id": "union-plaza",
    "place": "Union Plaza",
    "where": "Lincoln, Nebraska",
    "story": "A plaza and splash pad occupy the block where rail yards once divided downtown from the university. It is a newer public room on the walk toward campus.",
    "sourceLabel": "City of Lincoln",
    "sourceHref": "https://www.lincoln.ne.gov/"
  },
  {
    "id": "gateway",
    "place": "Gateway Mall",
    "where": "Lincoln, Nebraska",
    "story": "The indoor mall on the east side of Lincoln, near O Street, was the edge-of-town shopping center for a generation. The surrounding blocks are now a retail district of their own.",
    "sourceLabel": "City of Lincoln",
    "sourceHref": "https://www.lincoln.ne.gov/"
  },
  {
    "id": "southpointe",
    "place": "SouthPointe Pavilions",
    "where": "Lincoln, Nebraska",
    "story": "A retail center anchors the far south of Lincoln, well below the lettered grid. It marks how the city grew toward the county line in the late 20th century.",
    "sourceLabel": "City of Lincoln",
    "sourceHref": "https://www.lincoln.ne.gov/"
  },
  {
    "id": "havelock",
    "place": "Havelock",
    "where": "Lincoln, Nebraska",
    "story": "Havelock was a railroad town northeast of Lincoln before annexation. The old main street still reads as its own neighborhood, with the historic shopfronts near the Burlington shops.",
    "sourceLabel": "City of Lincoln",
    "sourceHref": "https://www.lincoln.ne.gov/"
  },
  {
    "id": "college-view",
    "place": "College View",
    "where": "Lincoln, Nebraska",
    "story": "College View grew around Union College in southeast Lincoln. The neighborhood kept its name after it joined the city, and the campus is still its center of gravity.",
    "sourceLabel": "Union College",
    "sourceHref": "https://www.ucollege.edu/"
  },
  {
    "id": "university-place",
    "place": "University Place",
    "where": "Lincoln, Nebraska",
    "story": "University Place was a streetcar suburb built around Nebraska Wesleyan. The campus and the old commercial corner are still the heart of the neighborhood.",
    "sourceLabel": "Nebraska Wesleyan",
    "sourceHref": "https://www.nebrwesleyan.edu/"
  },
  {
    "id": "near-south",
    "place": "Near South",
    "where": "Lincoln, Nebraska",
    "story": "Near South is the neighborhood immediately south of downtown, a grid of older houses between the Capitol and the parks along Antelope Creek. Residents usually just say the name of the nearest lettered street.",
    "sourceLabel": "City of Lincoln",
    "sourceHref": "https://www.lincoln.ne.gov/"
  },
  {
    "id": "hyde",
    "place": "Hyde Observatory",
    "where": "Lincoln, Nebraska",
    "story": "A public observatory stands on the south shore of Holmes Lake. Local astronomers open the dome for night programs, a quiet landmark beside the water.",
    "sourceLabel": "Hyde Observatory",
    "sourceHref": "https://en.wikipedia.org/wiki/Holmes_Lake_(Nebraska)"
  },
  {
    "id": "robbers-cave",
    "place": "Robber's Cave",
    "where": "Lincoln, Nebraska",
    "story": "Sandstone caves dug into a south Lincoln bluff became a local legend, often tied to outlaw stories that historians treat with care. The site is a real hollow in the rock, story optional.",
    "sourceLabel": "City of Lincoln",
    "sourceHref": "https://www.lincoln.ne.gov/"
  },
  {
    "id": "star-city-shores",
    "place": "Star City Shores",
    "where": "Lincoln, Nebraska",
    "story": "Lincoln's water park takes the city's Star City nickname. It sits in the south part of town, a summer landmark more than a historic one.",
    "sourceLabel": "Lincoln Parks",
    "sourceHref": "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"
  },
  {
    "id": "quilt-museum",
    "place": "International Quilt Museum",
    "where": "Lincoln, Nebraska",
    "story": "The International Quilt Museum, on East Campus, holds a large public collection of quilts from many countries. The building's glass galleries are a landmark on their own.",
    "sourceLabel": "International Quilt Museum",
    "sourceHref": "https://www.internationalquiltmuseum.org/"
  },
  {
    "id": "woods-park",
    "place": "Woods Park",
    "where": "Lincoln, Nebraska",
    "story": "A neighborhood park east of the Capitol, Woods is a local green rather than a citywide destination. Tennis courts and shade trees fill most of the block.",
    "sourceLabel": "Lincoln Parks",
    "sourceHref": "https://www.lincoln.ne.gov/City/Departments/Parks-and-Recreation"
  },
  {
    "id": "conestoga",
    "place": "Conestoga Lake",
    "where": "Lincoln, Nebraska",
    "story": "Conestoga is a flood-control lake southwest of the city, just inside the wider Lincoln map. The state recreation area wraps the water with a trail and a boat ramp.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "branched-oak",
    "place": "Branched Oak Lake",
    "where": "On the map",
    "story": "The largest of the Salt Valley lakes sits northwest of Lincoln. It was built for flood control and is now the region's main sailing and swimming water.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "mahoney",
    "place": "Eugene T. Mahoney State Park",
    "where": "On the map",
    "story": "Mahoney is the full-service state park between Lincoln and Omaha, with a lodge, a pool, and trails above the Platte. Families treat it as the nearest overnight park.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "sac-museum",
    "place": "Strategic Air Command & Aerospace Museum",
    "where": "On the map",
    "story": "The aerospace museum near Ashland displays bombers and missiles from the Strategic Air Command era. It stands beside the interstate, impossible to miss once you know the silhouette.",
    "sourceLabel": "SAC Aerospace Museum",
    "sourceHref": "https://sacmuseum.org/"
  },
  {
    "id": "seward",
    "place": "Seward",
    "where": "On the map",
    "story": "Seward is the county seat west of Lincoln, known locally for its Fourth of July festival. The courthouse square is the classic small-city target.",
    "sourceLabel": "City of Seward",
    "sourceHref": "https://en.wikipedia.org/wiki/Seward,_Nebraska"
  },
  {
    "id": "homestead",
    "place": "Homestead National Historical Park",
    "where": "On the map",
    "story": "The park near Beatrice marks the site of one of the first claims under the 1862 Homestead Act. A tallgrass prairie and the Palmer-Epard cabin tell the story of settlement.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/home/"
  },
  {
    "id": "pawnee-lake",
    "place": "Pawnee Lake",
    "where": "On the map",
    "story": "Pawnee is another Salt Valley reservoir, northwest of Ashland and east of Lincoln. Anglers and campers use the arms of the lake through the summer.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "platte-river-sp",
    "place": "Platte River State Park",
    "where": "On the map",
    "story": "The park climbs the bluffs on the south side of the Platte, east of Lincoln. Cabins and trails look over the river valley toward the Omaha side.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "ashland",
    "place": "Ashland",
    "where": "On the map",
    "story": "Ashland is a small city on the northwest road toward Omaha, just off the Platte. It is the town you pass when the lakes and Mahoney start to appear.",
    "sourceLabel": "City of Ashland",
    "sourceHref": "https://en.wikipedia.org/wiki/Ashland,_Nebraska"
  },
  {
    "id": "wahoo",
    "place": "Wahoo",
    "where": "On the map",
    "story": "Wahoo is the Saunders County seat north of Lincoln. The courthouse square is the center of town, and the place is proud of a long main street rather than a single monument.",
    "sourceLabel": "City of Wahoo",
    "sourceHref": "https://en.wikipedia.org/wiki/Wahoo,_Nebraska"
  },
  {
    "id": "wagon-train",
    "place": "Wagon Train Lake",
    "where": "On the map",
    "story": "Wagon Train is a reservoir south of Lincoln, part of the same flood-control chain as the lakes closer to town. The recreation area is a weekend drive down Highway 77.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "spring-creek",
    "place": "Spring Creek Prairie",
    "where": "On the map",
    "story": "Audubon's Spring Creek Prairie preserves tallgrass southwest of Lincoln. Trails cross remnant prairie that once covered this part of the state.",
    "sourceLabel": "Audubon",
    "sourceHref": "https://en.wikipedia.org/wiki/Spring_Creek_Prairie"
  },
  {
    "id": "arbor-lodge",
    "place": "Arbor Lodge",
    "where": "On the map",
    "story": "Arbor Lodge in Nebraska City was the estate of J. Sterling Morton, founder of Arbor Day. The mansion and its arboretum face the Missouri River bluffs.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "beatrice",
    "place": "Beatrice",
    "where": "On the map",
    "story": "Beatrice is the Gage County seat on the Big Blue River, south of Lincoln. The downtown courthouse square is the place most people mean when they name the town.",
    "sourceLabel": "City of Beatrice",
    "sourceHref": "https://en.wikipedia.org/wiki/Beatrice,_Nebraska"
  },
  {
    "id": "stagecoach",
    "place": "Stagecoach Lake",
    "where": "On the map",
    "story": "Stagecoach is one of the smaller Salt Valley lakes, south of Lincoln near the highway to Kansas. It is an easier miss than Branched Oak and a quieter shore.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "grand-island",
    "place": "Grand Island",
    "where": "Nebraska",
    "story": "Grand Island is the regional city in the Platte valley, west of Lincoln along the interstate. The downtown and the county courthouse sit near the middle of the urban area.",
    "sourceLabel": "City of Grand Island",
    "sourceHref": "https://en.wikipedia.org/wiki/Grand_Island,_Nebraska"
  },
  {
    "id": "henry-doorly",
    "place": "Henry Doorly Zoo",
    "where": "Nebraska",
    "story": "Omaha's zoo, south of downtown, is known for its desert dome, aquarium, and large animal exhibits. It is one of the state's most visited places.",
    "sourceLabel": "Henry Doorly Zoo",
    "sourceHref": "https://www.omahazoo.com/"
  },
  {
    "id": "old-market",
    "place": "Old Market",
    "where": "Nebraska",
    "story": "Omaha's Old Market is a warehouse district turned dining and arts quarter, just east of the modern downtown towers. The brick streets are the part people mean.",
    "sourceLabel": "Visit Omaha",
    "sourceHref": "https://www.visitomaha.com/"
  },
  {
    "id": "chimney-rock",
    "place": "Chimney Rock",
    "where": "Nebraska",
    "story": "The spire in western Nebraska was the landmark Oregon Trail emigrants watched for days. It still stands above the North Platte valley near Bayard.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/chro/"
  },
  {
    "id": "scotts-bluff",
    "place": "Scotts Bluff",
    "where": "Nebraska",
    "story": "A massive clay and sandstone bluff rises over the North Platte near Gering. Wagon trains used the pass at its foot, and a road now climbs to the summit.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/scbl/"
  },
  {
    "id": "archway",
    "place": "The Archway",
    "where": "Nebraska",
    "story": "A museum shaped like a covered bridge spans Interstate 80 at Kearney. It tells the story of trails and roads across the Platte valley, from wagons to the highway underneath.",
    "sourceLabel": "The Archway",
    "sourceHref": "https://en.wikipedia.org/wiki/Great_Platte_River_Road_Archway_Monument"
  },
  {
    "id": "durham",
    "place": "Durham Museum",
    "where": "Nebraska",
    "story": "Omaha's Union Station, a 1931 Art Deco railroad palace, is now the Durham Museum. The great hall still feels like a station even though the trains are gone.",
    "sourceLabel": "The Durham Museum",
    "sourceHref": "https://durhammuseum.org/"
  },
  {
    "id": "carhenge",
    "place": "Carhenge",
    "where": "Nebraska",
    "story": "A ring of gray-painted cars stands in a field north of Alliance, arranged like Stonehenge. It began as a family memorial and became one of the state's best-known roadside works.",
    "sourceLabel": "Carhenge",
    "sourceHref": "https://www.carhenge.com/"
  },
  {
    "id": "kingsley",
    "place": "Kingsley Dam",
    "where": "Nebraska",
    "story": "Kingsley Dam holds back Lake McConaughy, the big reservoir on the North Platte. The dam itself, not the far shoreline, is the point to find.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "smith-falls",
    "place": "Smith Falls",
    "where": "Nebraska",
    "story": "Nebraska's tallest waterfall drops over a bluff into the Niobrara River. A footbridge crosses the river to the base of the falls in the state park.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "fort-robinson",
    "place": "Fort Robinson",
    "where": "Nebraska",
    "story": "The old army post in northwest Nebraska is now a state park of barracks, stables, and parade ground. It is also the site of Crazy Horse's death in 1877.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "valentine",
    "place": "Valentine",
    "where": "Nebraska",
    "story": "Valentine is the town on the edge of the Sandhills and the Niobrara valley. Outfitters and the national wildlife refuge make it the north-central base camp.",
    "sourceLabel": "City of Valentine",
    "sourceHref": "https://en.wikipedia.org/wiki/Valentine,_Nebraska"
  },
  {
    "id": "joslyn",
    "place": "Joslyn Art Museum",
    "where": "Nebraska",
    "story": "Joslyn's marble Art Deco building sits north of downtown Omaha. The museum's collection and concert hall have anchored the city's arts district for decades.",
    "sourceLabel": "Joslyn Art Museum",
    "sourceHref": "https://www.joslyn.org/"
  },
  {
    "id": "golden-spike",
    "place": "Golden Spike Tower",
    "where": "Nebraska",
    "story": "An observation tower in North Platte looks over Bailey Yard, the Union Pacific's huge classification yard. The view is the reason the tower exists.",
    "sourceLabel": "Golden Spike Tower",
    "sourceHref": "https://en.wikipedia.org/wiki/Bailey_Yard"
  },
  {
    "id": "indian-cave",
    "place": "Indian Cave State Park",
    "where": "Nebraska",
    "story": "The park follows the Missouri River bluffs in the southeast corner of the state. A sandstone cave with Indigenous petroglyphs gives the park its name.",
    "sourceLabel": "Nebraska Game and Parks",
    "sourceHref": "https://outdoornebraska.gov/"
  },
  {
    "id": "ashfall",
    "place": "Ashfall Fossil Beds",
    "where": "Nebraska",
    "story": "A volcanic ash fall about twelve million years ago buried a waterhole full of rhinos and horses in northeast Nebraska. The fossils are still uncovered under a barn-like shelter.",
    "sourceLabel": "Ashfall Fossil Beds",
    "sourceHref": "https://ashfall.unl.edu/"
  },
  {
    "id": "toadstool",
    "place": "Toadstool Geologic Park",
    "where": "Nebraska",
    "story": "Soft clay and caprock in the far northwest have worn into toadstool shapes. The badlands trail is one of the strangest walks in the state.",
    "sourceLabel": "US Forest Service",
    "sourceHref": "https://en.wikipedia.org/wiki/Toadstool_Geologic_Park"
  },
  {
    "id": "chadron",
    "place": "Chadron",
    "where": "Nebraska",
    "story": "Chadron is a college town at the north end of the Pine Ridge, a long drive from Lincoln. Museum of the Fur Trade sits just east of town.",
    "sourceLabel": "City of Chadron",
    "sourceHref": "https://en.wikipedia.org/wiki/Chadron,_Nebraska"
  },
  {
    "id": "niobrara",
    "place": "Niobrara River at Valentine",
    "where": "Nebraska",
    "story": "East of Valentine the Niobrara is a national scenic river, braided between sandstone bluffs and cold-water springs. This point sits on that protected stretch.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/niob/"
  },
  {
    "id": "white-house",
    "place": "The White House",
    "where": "United States",
    "story": "The president's house has stood at 1600 Pennsylvania Avenue since 1800. The limestone walls were painted white after the British burned the interior in 1814.",
    "sourceLabel": "The White House",
    "sourceHref": "https://www.whitehouse.gov/"
  },
  {
    "id": "golden-gate",
    "place": "Golden Gate Bridge",
    "where": "United States",
    "story": "The suspension bridge opened in 1937 across the mouth of San Francisco Bay. Its color, international orange, was chosen to be seen in fog.",
    "sourceLabel": "Golden Gate Bridge",
    "sourceHref": "https://www.goldengate.org/"
  },
  {
    "id": "grand-canyon",
    "place": "Grand Canyon",
    "where": "United States",
    "story": "The South Rim village looks into a gorge cut by the Colorado River, more than a mile deep in places. This point is the main visitor area, not the whole canyon.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/grca/"
  },
  {
    "id": "old-faithful",
    "place": "Old Faithful",
    "where": "United States",
    "story": "The geyser in Yellowstone erupts often enough that crowds plan around it. It sits in the Upper Geyser Basin, among many less predictable vents.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/yell/"
  },
  {
    "id": "rushmore",
    "place": "Mount Rushmore",
    "where": "United States",
    "story": "Four presidential faces were carved into a granite peak in the Black Hills between 1927 and 1941. The viewing terrace faces the sculpture from the north.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/moru/"
  },
  {
    "id": "gateway-arch",
    "place": "Gateway Arch",
    "where": "United States",
    "story": "Eero Saarinen's stainless arch on the St. Louis riverfront was completed in 1965. It commemorates the city's role as a starting point for westward travel.",
    "sourceLabel": "Gateway Arch",
    "sourceHref": "https://www.nps.gov/jeff/"
  },
  {
    "id": "french-quarter",
    "place": "Jackson Square",
    "where": "United States",
    "story": "Jackson Square is the public plaza at the heart of New Orleans' French Quarter, facing St. Louis Cathedral. The river is a short walk beyond the levee.",
    "sourceLabel": "New Orleans",
    "sourceHref": "https://www.neworleans.com/"
  },
  {
    "id": "space-needle",
    "place": "Space Needle",
    "where": "United States",
    "story": "The tower was built for the 1962 world's fair in Seattle. It still stands over the Seattle Center, with the observation deck near the top of the saucer.",
    "sourceLabel": "Space Needle",
    "sourceHref": "https://www.spaceneedle.com/"
  },
  {
    "id": "niagara",
    "place": "Niagara Falls",
    "where": "United States",
    "story": "The American Falls drop over a cliff on the New York side of the Niagara River. The larger Horseshoe Falls curves into Canada a short distance away.",
    "sourceLabel": "Niagara Falls State Park",
    "sourceHref": "https://en.wikipedia.org/wiki/Niagara_Falls"
  },
  {
    "id": "alamo",
    "place": "The Alamo",
    "where": "United States",
    "story": "The former mission church in downtown San Antonio was the site of the 1836 siege. The chapel facade is the image most people are aiming for.",
    "sourceLabel": "The Alamo",
    "sourceHref": "https://www.thealamo.org/"
  },
  {
    "id": "willis",
    "place": "Willis Tower",
    "where": "United States",
    "story": "The black steel tower in downtown Chicago was the world's tallest building when it opened in 1973 as the Sears Tower. The Skydeck looks out over the lake.",
    "sourceLabel": "Willis Tower",
    "sourceHref": "https://en.wikipedia.org/wiki/Willis_Tower"
  },
  {
    "id": "crater-lake",
    "place": "Crater Lake",
    "where": "United States",
    "story": "A collapsed volcano in southern Oregon holds a deep blue lake with no river inlet. The water comes from rain and snow, and Wizard Island rises inside the caldera.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/crla/"
  },
  {
    "id": "monument-valley",
    "place": "Monument Valley",
    "where": "United States",
    "story": "Sandstone buttes stand on the Navajo Nation along the Arizona-Utah line. The view from the visitor center is the classic one, not every spire in the valley.",
    "sourceLabel": "Navajo Nation Parks",
    "sourceHref": "https://en.wikipedia.org/wiki/Monument_Valley"
  },
  {
    "id": "pike-place",
    "place": "Pike Place Market",
    "where": "United States",
    "story": "The public market has run above Seattle's waterfront since 1907. The main arcade, not the whole hillside, is the spot to place.",
    "sourceLabel": "Pike Place Market",
    "sourceHref": "https://www.pikeplacemarket.org/"
  },
  {
    "id": "cadillac",
    "place": "Cadillac Mountain",
    "where": "United States",
    "story": "The granite summit in Acadia National Park is the highest point on the United States Atlantic coast. For part of the year it catches the country's first sunrise.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/acad/"
  },
  {
    "id": "denali",
    "place": "Denali",
    "where": "United States",
    "story": "The highest peak in North America rises from the Alaska Range. The summit, not the park entrance hours away by road, is the point.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/dena/"
  },
  {
    "id": "everglades",
    "place": "Everglades",
    "where": "United States",
    "story": "The River of Grass covers the southern tip of Florida. This point is the Royal Palm area of the national park, a boardwalk into the sawgrass rather than the whole watershed.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/ever/"
  },
  {
    "id": "death-valley",
    "place": "Badwater Basin",
    "where": "United States",
    "story": "Badwater Basin in Death Valley is the lowest point in North America, a salt flat below sea level. Summer heat here is among the highest recorded on Earth.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/deva/"
  },
  {
    "id": "hoover",
    "place": "Hoover Dam",
    "where": "United States",
    "story": "The concrete arch dam plugs the Colorado River between Nevada and Arizona, forming Lake Mead. It was finished in 1936 and still carries a highway across the crest.",
    "sourceLabel": "Bureau of Reclamation",
    "sourceHref": "https://www.usbr.gov/lc/hooverdam/"
  },
  {
    "id": "eiffel",
    "place": "Eiffel Tower",
    "where": "World",
    "story": "Gustave Eiffel's iron tower was built for the 1889 world's fair in Paris. It was meant to be temporary and is now the city's most familiar silhouette.",
    "sourceLabel": "Eiffel Tower",
    "sourceHref": "https://www.toureiffel.paris/en"
  },
  {
    "id": "colosseum",
    "place": "Colosseum",
    "where": "World",
    "story": "The amphitheater in central Rome opened in 80 CE. It held tens of thousands for public games and still anchors the east end of the Roman Forum.",
    "sourceLabel": "Colosseum",
    "sourceHref": "https://colosseo.it/en/"
  },
  {
    "id": "liberty",
    "place": "Statue of Liberty",
    "where": "World",
    "story": "The copper figure stands on Liberty Island in New York Harbor, a gift from France dedicated in 1886. The island, not the Manhattan skyline, is the target.",
    "sourceLabel": "National Park Service",
    "sourceHref": "https://www.nps.gov/stli/"
  },
  {
    "id": "taj",
    "place": "Taj Mahal",
    "where": "World",
    "story": "The marble mausoleum in Agra was built in the 17th century for Mumtaz Mahal. It sits in a formal garden on the south bank of the Yamuna.",
    "sourceLabel": "Taj Mahal",
    "sourceHref": "https://www.tajmahal.gov.in/",
    "image": "images/journal/taj.webp",
    "imageAlt": "Storybook drawing of the Taj Mahal, its white dome and towers beside a garden pool and the river."
  },
  {
    "id": "opera-house",
    "place": "Sydney Opera House",
    "where": "World",
    "story": "Jørn Utzon's sail-like shells stand on a point in Sydney Harbour. The building opened in 1973 after a long and difficult construction.",
    "sourceLabel": "Sydney Opera House",
    "sourceHref": "https://www.sydneyoperahouse.com/",
    "image": "images/journal/opera-house.webp",
    "imageAlt": "Storybook drawing of the Sydney Opera House's white sail-like shells on the harbour point, with ferries and sailboats on the water."
  },
  {
    "id": "redeemer",
    "place": "Christ the Redeemer",
    "where": "World",
    "story": "The concrete statue looks over Rio de Janeiro from the summit of Corcovado. It was completed in 1931 and is reached by a cog railway through the forest.",
    "sourceLabel": "Christ the Redeemer",
    "sourceHref": "https://en.wikipedia.org/wiki/Christ_the_Redeemer_(statue)",
    "image": "images/journal/redeemer.webp",
    "imageAlt": "Storybook drawing of Christ the Redeemer on the forested summit of Corcovado, with the little cog railway and the city below."
  },
  {
    "id": "sagrada",
    "place": "Sagrada Família",
    "where": "World",
    "story": "Antoni Gaudí's basilica in Barcelona has been under construction since 1882. The towers and the organic stonework are still being finished.",
    "sourceLabel": "Sagrada Família",
    "sourceHref": "https://sagradafamilia.org/en/"
  },
  {
    "id": "giza",
    "place": "Great Pyramid of Giza",
    "where": "World",
    "story": "The largest pyramid at Giza was built for the pharaoh Khufu more than 4,500 years ago. It is the oldest of the structures people still call wonders of the world.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/86/"
  },
  {
    "id": "cn-tower",
    "place": "CN Tower",
    "where": "World",
    "story": "The communications tower in Toronto was the world's tallest free-standing structure when it opened in 1976. The main pod holds the observation decks.",
    "sourceLabel": "CN Tower",
    "sourceHref": "https://www.cntower.ca/"
  },
  {
    "id": "machu",
    "place": "Machu Picchu",
    "where": "World",
    "story": "The Inca estate sits on a ridge above the Urubamba River in Peru. It was built in the 15th century and became widely known again in 1911.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/274/"
  },
  {
    "id": "fuji",
    "place": "Mount Fuji",
    "where": "World",
    "story": "The volcano southwest of Tokyo is Japan's highest peak. The summit crater, not the lakes at the base, is the point to place.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/1418/"
  },
  {
    "id": "chichen",
    "place": "Chichén Itzá",
    "where": "World",
    "story": "The Maya city in Yucatán is famous for the stepped pyramid called El Castillo. At the equinox, the evening sun draws a serpent of light down the stair.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/483/"
  },
  {
    "id": "stonehenge",
    "place": "Stonehenge",
    "where": "World",
    "story": "The stone circle on Salisbury Plain was raised in stages beginning about 5,000 years ago. The largest stones came from a site in Wales.",
    "sourceLabel": "English Heritage",
    "sourceHref": "https://www.english-heritage.org.uk/visit/places/stonehenge/"
  },
  {
    "id": "neuschwanstein",
    "place": "Neuschwanstein",
    "where": "World",
    "story": "Ludwig II's castle in the Bavarian Alps was unfinished when he died in 1886. The pale towers above the gorge are what most people are looking for.",
    "sourceLabel": "Neuschwanstein",
    "sourceHref": "https://en.wikipedia.org/wiki/Neuschwanstein_Castle"
  },
  {
    "id": "angkor",
    "place": "Angkor Wat",
    "where": "World",
    "story": "The temple complex in Cambodia was built in the 12th century as a Hindu monument and later became a Buddhist one. Its five towers are the aim point.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/668/"
  },
  {
    "id": "petra",
    "place": "Petra",
    "where": "World",
    "story": "The Nabataean city in southern Jordan is entered through a narrow canyon. The Treasury facade, carved from the cliff, is the usual target.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/326/"
  },
  {
    "id": "table-mountain",
    "place": "Table Mountain",
    "where": "World",
    "story": "The flat-topped mountain stands over Cape Town. A cableway climbs the plateau, which is a national park above the city.",
    "sourceLabel": "Table Mountain",
    "sourceHref": "https://www.sanparks.org/parks/table-mountain"
  },
  {
    "id": "uluru",
    "place": "Uluru",
    "where": "World",
    "story": "The sandstone monolith in Australia's Northern Territory is a sacred place for the Anangu people. The rock itself, not the resort to the north, is the point.",
    "sourceLabel": "Parks Australia",
    "sourceHref": "https://parksaustralia.gov.au/uluru/"
  },
  {
    "id": "victoria-falls",
    "place": "Victoria Falls",
    "where": "World",
    "story": "The Zambezi River drops into a narrow gorge on the border of Zambia and Zimbabwe. The spray, not a wide cascade, is what you see from the rim.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/509/"
  },
  {
    "id": "fushimi",
    "place": "Fushimi Inari",
    "where": "World",
    "story": "Thousands of vermilion gates climb the mountain behind a shrine in southern Kyoto. The main shrine at the base of the trail is the point to place.",
    "sourceLabel": "Fushimi Inari",
    "sourceHref": "https://en.wikipedia.org/wiki/Fushimi_Inari-taisha"
  },
  {
    "id": "iguazu",
    "place": "Iguazú Falls",
    "where": "World",
    "story": "A chain of waterfalls spans the Iguazú River where Argentina meets Brazil. The Devil's Throat is the narrow horseshoe at the heart of the system.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/303/"
  },
  {
    "id": "tongariki",
    "place": "Ahu Tongariki",
    "where": "World",
    "story": "Fifteen moai stand on a stone platform on the southeast coast of Rapa Nui. It is the largest restored ahu on the island.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/715/"
  },
  {
    "id": "potala",
    "place": "Potala Palace",
    "where": "World",
    "story": "The palace rises above Lhasa on a hill that was already sacred before the present buildings. It was the winter home of the Dalai Lamas for centuries.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/707/"
  },
  {
    "id": "timbuktu",
    "place": "Timbuktu",
    "where": "World",
    "story": "The city in Mali was a hub of the trans-Saharan trade and of Islamic learning. Its mosques and manuscript libraries still mark the historic center.",
    "sourceLabel": "UNESCO",
    "sourceHref": "https://whc.unesco.org/en/list/119/"
  },
  {
    "id": "galapagos",
    "place": "Puerto Ayora",
    "where": "World",
    "story": "Puerto Ayora is the largest town in the Galápagos, on the south coast of Santa Cruz. The research station and the harbor are the local landmark, not the whole archipelago.",
    "sourceLabel": "Galápagos",
    "sourceHref": "https://en.wikipedia.org/wiki/Puerto_Ayora"
  }
];
