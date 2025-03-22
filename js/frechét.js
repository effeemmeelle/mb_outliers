const frechet_json = "json/frechet_first_100.json";
const info_json = "json/info_first_100.json";
const trajectories_json = "json/trajectories_first_100.json";

console.log("test");
Promise.all([
    d3.json(frechet_json), 
    d3.json(info_json)
]).then(function([similarityDataJson, infoDataJson]) {
    console.log("ok")
    similarityData = similarityDataJson.slice(1); // ignores the heading
    infoData = infoDataJson;

    // Create nodes array from the data
    const nodes = similarityData.map((_, index) => ({
        id: index,
        sIDrID: `${infoData[index]?.sessionID}_${infoData[index]?.repetitionID}`,
        sessionID: infoData[index]?.sessionID || `unknown_${index}`,
        repetitionID: infoData[index]?.repetitionID || 0,
        userID: infoData[index]?.userID || "unknown",
        hand: infoData[index]?.hand || "unknown",
        gender: infoData[index]?.gender || "unknown",
        dominantHand: infoData[index]?.dominantHand || "unknown",
        age: infoData[index]?.age || null,
        deviceID: infoData[index]?.deviceID || "unknown",
        deviceModel: infoData[index]?.deviceModel || "unknown",
        os: infoData[index]?.os || "unknown",
        language: infoData[index]?.language || "unknown",
        screenWidth: infoData[index]?.screenWidth || 0,
        screenHeight: infoData[index]?.screenHeight || 0,
        dpi: infoData[index]?.dpi || 0,
        screenSize: infoData[index]?.screenSize || 0,
        dateInserted: infoData[index]?.dateInserted_x || "unknown"
    }));

    threshold = 0.05;

    // Add event listener for accuracy treshold
    document.getElementById('update-btn').addEventListener('click', function() {
        // Get the current value of the threshold input field
        threshold = parseFloat(document.getElementById('threshold').value);
        d3.select("svg").selectAll("*").remove();
        initializeForceSimulation(nodes, threshold);
    });

    // listener for "clear" button
    document.getElementById('clear-btn').addEventListener('click', function() {
        // Get the current value of the threshold input field
        drawCircle();
    });

    // Proceed to force simulation and visualization setup
    initializeForceSimulation(nodes, threshold);
});


function initializeForceSimulation(nodes, threshold) {
    // Dimensions for the graph
    const width = window.innerWidth;
    const height = window.innerHeight;

    drawCircle();

    let links = [];
    for (let i = 0; i < similarityData.length; i++) {
        for (let j = i + 1; j < similarityData.length; j++) { 
            if ((similarityData[i][j] <= threshold) && (i != j)) {
                links.push({ source: i, target: j, value: similarityData[i][j] });
            }
        }
    }

    // Set up centrality values (degree-based)
    let centralityValues = nodes.map(node => ({
        id: node.id,
        degree: links.filter(link => link.source === node.id || link.target === node.id).length
    }));

    
    // Create a lookup map for fast access
    let degreeMap = new Map(centralityValues.map(d => [d.id, d.degree]));
    
    // Prioritize higher centrality
    let prioritizeHigherCentrality = true;

    // Define the color scale based on degree (centrality)
    let colorScale = d3.scaleSequential(d3.interpolateBlues)  // Or d3.interpolateViridis for better contrast
        .domain([d3.max(centralityValues, d => d.degree), d3.min(centralityValues, d => d.degree)]);

    function color(i){
        if(i==0){
            return colorScale(0);
        }
        else if(i==1) {
            return colorScale(5);
        }
        else if(i==2) {
            return colorScale(10);
        }
        else
            return colorScale(d3.max(centralityValues, d => d.degree)-1);
    };

    function size(i){
        if(i==0){
            return 50;
        }
        else if(i==1) {
            return 45;
        }
        else
            return 40;
    };

    // Create the force simulation
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id))
        .force("manyBody", d3.forceManyBody().strength(-100).distanceMin(50))
        .force("x", d3.forceX()) 
        .force("y", d3.forceY())
        .force("radius", d3.forceRadial(d => {
            if(degreeMap.get(d.id) > 10){
                return 0;
            }
            else if(degreeMap.get(d.id) > 5){
                return width*0.75; // TODO
            }
            else if(degreeMap.get(d.id) < 5 && degreeMap.get(d.id)>1){
                return width; // TODO
            }
            else if(degreeMap.get(d.id) == 1){
                return width*1.75; // TODO
            }
            else{return width*2}
        }))
        .force("collide", d3.forceCollide(75)) //d3.forceCollide(d => 2*(d3.max(centralityValues, d => d.degree) - degreeMap.get(d.id)))); // Collision padding
        

    // Create the SVG container
    const svg = d3.select("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width/2*3, -height / 2, width * 3, height])  // Fit to window size (for central positioning)
        .style("border", "1px solid black"); // Add border for visibility

    // Create a tooltip div
    const tooltip = d3.select("body")
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "1px")
        .style("border-radius", "5px")
        .style("padding", "5px")
        .style("pointer-events", "none"); // Prevents tooltip from interfering with mouse events

    // Function to find all nodes connected to a given node through any path
    function findConnectedNodes(node, links) {
        let visited = new Set();
        let stack = [node.id];  // Start with the current node

        while (stack.length > 0) {
            let currentId = stack.pop();
            visited.add(currentId);

            // Find all links connected to the current node
            links.forEach(link => {
                if (link.source.id === currentId && !visited.has(link.target.id)) {
                    stack.push(link.target.id);  // Add target node to the stack
                }
                if (link.target.id === currentId && !visited.has(link.source.id)) {
                    stack.push(link.source.id);  // Add source node to the stack
                }
            });
        }

        return visited;  // Return all connected nodes
    }

    // Tooltip event handlers
    const mouseover = function(event, d) {
        tooltip
            .style("opacity", 1);

        d3.select(this)
            .attr("stroke", "black")
            .attr("stroke-width", 2);

        // Find all nodes connected to the hovered node through any path
        const connectedNodes = findConnectedNodes(d, links);
        
        // Highlight the links connected to the hovered node or any node in the connected path
        d3.selectAll("line")
            .filter(l => connectedNodes.has(l.source.id) && connectedNodes.has(l.target.id))  // Check if both source and target are connected
            .raise()  // Moves selected links to the front
            .style("stroke", "pink")
            .style("stroke-width", 2.5)
            .filter(l => l.source.id === d.id || l.target.id === d.id)
            .style("stroke", "red")
            .style("stroke-width", 4);
    };

    const mousemove = function(event, d) {
        tooltip
            .html(`
                <strong>Session:</strong> ${d.sessionID} <br>
                <strong>User ID:</strong> ${d.userID} <br>
                <strong>Degree:</strong> ${degreeMap.get(d.id)} 
            `) // You need to implement degree logic
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px")
            .style("background-color", "rgba(255, 255, 255, 0.4)") // Semi-transparent black
        };

    const mouseleave = function(event, d) {
        tooltip
            .style("opacity", 0);
        d3.select(this)
            .attr("stroke", "gray")
            .attr("stroke-width", 1.5);

        // Reset all links to their default state
        d3.selectAll("line")
            .style("stroke", "gray")
            .style("stroke-width", 1);
    };


    // Add a line for each link
    const link = svg.append("g")
        .attr("stroke", "white")
        .attr("stroke-opacity", 1)
        .selectAll("line")
        .data(links)
        .join("line")
        .style("stroke", "gray")
        .attr("strength", 100)
    
    
    

    // Add nodes (circles)
    const node = svg.append("g")
        .attr("stroke", "gray")
        .attr("stroke-width", 2)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", d => {
            return size(degreeMap.get(d.id));
        })
        .attr("fill", d => color(degreeMap.get(d.id))) // Default to 0 if undefined
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave)
        .on("click", function(_event, d) {
            drawTrajectory(d); // Trigger the trajectory drawing function
        });;

    simulation
        .on("tick", () => {
            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
        });

    // Add a drag behavior to the nodes
    // node.call(d3.drag()
        // .on("start", dragstarted)
        // .on("drag", dragged)
        // .on("end", dragended));

    // Drag behavior functions
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    simulation.restart();
}

function drawCircle() {
    // Clear the existing SVG content
    const svgContainer = d3.select("#trajectories");
    svgContainer.selectAll("*").remove();

    
    const width = window.innerWidth / 3;
    const height = window.innerHeight / 3;

    // Flatten all x and y values into separate arrays
    const allX = [];
    const allY = [];

    // Compute extents
    const xExtent = [0,1]; // [minX, maxX]
    const yExtent = [0,1]; // [minY, maxY]

    // Create the new SVG element inside the container
    const svg = svgContainer
        .attr("width", width)
        .attr("height", height);
    // Define scales
    const x = d3.scaleLinear()
        .domain(xExtent)
        .range([0, 300]);

    const y = d3.scaleLinear()
        .domain(yExtent)
        .range([0, 300]);

    // --------------- Add Circle Overlay ---------------

    // Define circle parameters
    const circleCenter = [0.5, 0.5]; // Center of the circle in normalized coordinates (range from 0 to 1)
    const radius_1 = 0.3; // Radius of the inner circle (in normalized units, from 0 to 1)

    // Generate the circle data using polar coordinates
    const circleData = d3.range(0, 2 * Math.PI, 0.01).map(function(t) {
        return [
            circleCenter[0] + radius_1 * Math.cos(t), // x = center_x + r * cos(t)
            circleCenter[1] + radius_1 * Math.sin(t)  // y = center_y + r * sin(t)
        ];
    });

    // These values are an approximation because I don't know the original circle size
    // I got it by examining the 100% accuracy trajectories visually

    // Append the circle path to the SVG
    const circleLine = d3.line()
        .x(d => x(d[0]))  // Map circle x-coordinates to the plot scale
        .y(d => y(d[1])); // Map circle y-coordinates to the plot scale

    svg.append("path")
        .datum(circleData)
        .attr("fill", "none")
        .attr("stroke", "blue")
        .attr("opacity", 0.1)
        .attr("stroke-width", 20)
        .attr("d", circleLine) // Draw the circle on the same plot
        .lower();
};



function drawTrajectory(node) {
    // Clear the existing SVG content
    const svgContainer = d3.select("#trajectories");
    d3.json(trajectories_json).then((data) => {
        console.log(data)
        // Extract the trajectory data for the clicked node
        const nodeIndex = node.sIDrID;

        const nodeTrajectoryData = data[nodeIndex];
        console.log(nodeTrajectoryData)

        // Define margins and dimensions for the new SVG, based on viewport size
        const width = window.innerWidth / 3;
        const height = window.innerHeight / 3;

        // Flatten all x and y values into separate arrays
        const allX = [];
        const allY = [];

        let ratio = node.screenHeight / node.screenWidth;

        Object.values(data).forEach(points => {
            points.forEach(([x, y]) => {
                allX.push(x);
                allY.push(y * ratio);
            });
        });

        // Compute extents
        const xExtent = [0, 1]; // [minX, maxX]
        const yExtent = [0, 1]; // [minY, maxY]


        // Define scales
        const x = d3.scaleLinear()
            .domain(xExtent)
            .range([0, 300]);

        const y = d3.scaleLinear()
            .domain(yExtent)
            .range([0, 300]);

        // Create the new SVG element inside the container
        const svg = svgContainer
            .attr("width", width)
            .attr("height", height);

        // Define the line generator function for the trajectory path
        const line = d3.line()
            .x(d => x(d[0])) // x-coordinate of trajectory points
            .y(d => y(d[1]) * 1.7); // y-coordinate of trajectory points


        // Create a color scale based on interpolation
        const scaleColor = d3.scaleSequential(d3.interpolateReds) // You can use other color interpolations like d3.interpolateViridis or d3.interpolateInferno
            .domain([-10, 100]); // Avoid whites


        // Generate a random number between 1 and 100
        let i = Math.floor(Math.random() * 100) + 1;

        // Get the color corresponding to the random number
        let randColor = scaleColor(i);

        // Append the trajectory path to the SVG
        svg.append("path")
            .datum(nodeTrajectoryData)
            .attr("fill", "none")
            .attr("stroke", randColor) // Use the color generated from the scale
            .attr("stroke-width", 1.5)
            .attr("d", line);


    });
}
