const frechet_json = "json/frechet_first_1000.json";
const info_json = "json/info_first_1000.json";
const trajectories_json = "json/trajectories_first_1000.json";

async function copyText(elementId) {
    const text = document.getElementById(`${elementId}`).innerText;
    try {
        await navigator.clipboard.writeText(text); //clipboard API
        // alert("Copied: " + text); //debug
    } catch (err) {
        alert("Failed to copy"); //debug
    }
}

async function pasteText(elementId) {
    const pasteField = document.getElementById(`${elementId}`);

    try {
        const text = await navigator.clipboard.readText();
        pasteField.value = text;
    } catch (err) {
        alert("Failed to paste"); //debug
    }
}

Promise.all([
    d3.json(info_json),
    d3.json(frechet_json)
]).then(function([dataJson, frechetJson]) {
    frechet = frechetJson.slice(1) // ignores heading
    data = dataJson; // data is a list, not an object

    let threshold = parseFloat(document.getElementById('threshold').value);
    let biggerOut = document.getElementById('biggerOut').checked;
    let invertColor = document.getElementById('invertColor').checked;
    let invertSize = document.getElementById('invertSize').checked;

    let slider = document.getElementById("myRange").value;
    
    // node input from user
    let userInput = document.getElementById('user-input').value;
    let sessionInput = document.getElementById('session-input').value;
    let repetitionInput = document.getElementById('repetition-input').value;
    let handInput = document.getElementById('hand-input').value;
    let dHandInput = document.getElementById('d-hand-input').value;
    let inputs = [userInput, sessionInput, repetitionInput, handInput, dHandInput]; // array of strings
    
    // radio input; if true -> selection behaviour of input is and
    let andSelection = document.getElementById("andOption").checked;
    
    // Create nodes array from the data
    const nodes = data.map((info, index) => ({
        id: index,
        unique: `${info.sessionID}_${info.repetitionID}`,  // Unique ID from sessionID and repetitionID
        sessionID: info.sessionID || `unknown_${index}`,
        repetitionID: info.repetitionID || 0,
        userID: info.userID || "unknown",
        hand: info.hand || "unknown",
        gender: info.gender || "unknown",
        dominantHand: info.dominantHand || "unknown",
        age: info.age || null,
        deviceID: info.deviceID || "unknown",
        deviceModel: info.deviceModel || "unknown",
        os: info.os || "unknown",
        language: info.language || "unknown",
        screenWidth: info.screenWidth || 0,
        screenHeight: info.screenHeight || 0,
        dpi: info.dpi || 0,
        screenSize: info.screenSize || 0,
        dateInserted: info.dateInserted_x || "unknown",
    }));

    // Add event listener for update button
    document.getElementById('update-btn').addEventListener('click', function() {
        // Get the current value of the threshold input field
        threshold = parseFloat(document.getElementById('threshold').value);
        biggerOut = document.getElementById('biggerOut').checked;
        invertColor = document.getElementById('invertColor').checked;
        invertSize = document.getElementById('invertSize').checked;
        userInput = document.getElementById('user-input').value;
        sessionInput = document.getElementById('session-input').value;
        repetitionInput = document.getElementById('repetition-input').value;
        handInput = document.getElementById('hand-input').value;
        dHandInput = document.getElementById('d-hand-input').value;
        inputs = inputs = [userInput, sessionInput, repetitionInput, handInput, dHandInput];
        andSelection = document.getElementById("andOption").checked;
        slider = document.getElementById("myRange").value;

        d3.select("svg").selectAll("*").remove();
        // Restart the simulation with the new threshold value
        initializeForceSimulation(nodes, threshold, biggerOut, invertColor, invertSize, inputs, andSelection, slider);
    });

    // listener for "clear" button
    document.getElementById('clear-btn').addEventListener('click', function() {
        // Get the current value of the threshold input field
        drawCircle();
    });

    

    initializeForceSimulation(nodes, threshold, biggerOut, invertColor, invertSize, inputs, andSelection, slider);
});

function initializeForceSimulation(nodes, threshold, biggerOut, invertColor, invertSize, inputs, andSelection, slider) {


    drawCircle(nodes);

    // Dimensions for the graph
    const width = window.innerWidth;
    const height = window.innerHeight; 

    console.log(slider)

    let links = [];
    for (let i = 0; i < frechet.length; i++) {
        for (let j = i + 1; j < frechet.length; j++) { 
            if ((frechet[i][j] <= threshold) && (i != j)) {
                links.push({ source: i, target: j, value: frechet[i][j] });
            }
        }
    }

    // Degree-based centrality calculation
    let centralityValues = nodes.map(node => ({
        id: node.id,
        degree: links.filter(link => link.source === node.id || link.target === node.id).length
    }));

    // Sum all the degrees
    let totalDegree = centralityValues.reduce((sum, node) => sum + node.degree, 0);

    // Calculate the average degree
    let averageDegree = totalDegree / centralityValues.length;

    let degreeMap = new Map(centralityValues.map(d => [d.id, d.degree]));


    // Find the minimum and maximum centrality values
    const minCentrality = Math.min(...centralityValues.map(c => c.degree));
    const maxCentrality = Math.max(...centralityValues.map(c => c.degree));

    console.log(minCentrality, maxCentrality)

    // Define a scale for centrality (log scale for the radius)
    let centralityRadiusScale = d3.scaleLinear()
        .domain([minCentrality, maxCentrality])  // Inverse log scale (to make higher centrality nodes larger)
        .range([10, 50]);

    if(invertSize==true){
        centralityRadiusScale = d3.scaleLinear()
        .domain([minCentrality, maxCentrality])
        .range([50, 10]);      
    }               

    // You can similarly create a color scale based on centrality
    let centralityColorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([maxCentrality, minCentrality]);
    
    if(invertColor==true){
        centralityColorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([minCentrality, maxCentrality]);
    }

    // checks if the user has input something
    let existsInput = inputs[0] !== "" || inputs[1] !== "" || inputs[2] !== "" || inputs[3] !== "" || inputs[4] !== ""
    
    let sliderPerc = maxCentrality/slider


    // Update the force simulation to use centrality for radius and color
    const simulation = d3.forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength())
        .force("radial", d3.forceRadial(d => {
            
            let nodeRadius = degreeMap.get(d.id);
            
            if(existsInput==false){ // user hasn't input anything -> normal behaviour
                
                if (biggerOut == true){
                    if (nodeRadius <= sliderPerc)
                        // to have just an outer radius and a middle circle: return width*1.3
                        return width*1.3 // better nodes are pulled out
                    else
                        return 0 // worst nodes in the middle
                } else { // default -> the low accuracy nodes in the middle
                    if (nodeRadius <= sliderPerc)
                        return 0; // better nodes are pulled a little farther
                    else
                        // to have just an outer radius and a middle circle: return width*1.3
                        return width*0.5+0.7*width*(nodeRadius/maxCentrality); // better nodes are pulled out
                }
            } else { // user has input something
                if(biggerOut == false){ // selected nodes go in the middle
                    if(andSelection==false){ // default behaviour: OR
                        if (
                        //checks for user input == to at least one node property
                        inputs[0]==d.userID || inputs[1]==d.sessionID || inputs[2]==d.repetitionID || inputs[3]==d.hand || inputs[4]==d.dominantHand)
                            return 0; // the selected nodes are in the middle
                        else
                            return width*4; // all other nodes are on the radius
                    } else {
                        if (
                            //checks for user input == to node property; AND for all fields that have an input
                            (inputs[0]==d.userID || inputs[0] == "") && 
                            (inputs[1]==d.sessionID || inputs[1] == "") && 
                            (inputs[2]==d.repetitionID || inputs[2] == "") && 
                            (inputs[3]==d.hand || inputs[3] == "") && 
                            (inputs[4]==d.dominantHand || inputs[4] == ""))
                                return 0; // the selected nodes are in the middle
                            else
                                return width*1.3; // all other nodes are on the radius

                        }
                } else { //biggerOut is true: low acc in the middle, selected nodes go on radius

                    if(andSelection==false){ // OR behaviour
                        if(inputs[0]==d.userID || inputs[1]==d.sessionID || inputs[2]==d.repetitionID || inputs[3]==d.hand || inputs[4]==d.dominantHand)
                            return width*4; // the selected nodes are on the radius
                        else
                            return 0; // all other nodes are in the middle
                    } else { // orselect
                        if(
                        (inputs[0]==d.userID || inputs[0] == "") && 
                        (inputs[1]==d.sessionID || inputs[1] == "") && 
                        (inputs[2]==d.repetitionID || inputs[2] == "") && 
                        (inputs[3]==d.hand || inputs[3] == "") && 
                        (inputs[4]==d.dominantHand || inputs[4] == ""))
                            return width*1.3; // the selected nodes are on the radius
                        else
                            return 0; // all other nodes are in the middle
                    }
                }
            }
        }))
        .force("collide", d3.forceCollide(d => centralityRadiusScale(degreeMap.get(d.id)) + 2)) // Collision padding using centrality
        .on("tick", () => {
            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("r", d => centralityRadiusScale(degreeMap.get(d.id)))  // Set node radius based on centrality
                .style("fill", d => centralityColorScale(degreeMap.get(d.id))); // Set node color based on centrality
        });
    
        // Create the SVG container
        const svg = d3.select("svg")
        .attr("width", width*3)
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

    // Tooltip event handlers
    const mouseover = function(event, d) {
        tooltip
            .style("opacity", 1);
        
        d3.select(this)
            .attr("stroke", "black")
            .attr("stroke-width", 2.5);
    };

    const mousemove = function(event, d) {
        tooltip
            .html(`
                <strong>Session:</strong> ${d.sessionID} <br>
                <strong>User ID:</strong> ${d.userID} <br>
                <strong>Degree:</strong> ${degreeMap.get(d.id)} <br>

            `) // need to implement acc
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
    };

    const mouseleave = function(event, d) {
        tooltip
            .style("opacity", 0);
        d3.select(this)
            .attr("stroke", "gray")
            .attr("stroke-width", 1.5);
    };

    // Create and attach the brush
    const brush = d3.brush()
        .extent([[-1800, -1800], [1800, 1800]]) // Define the extent based on your SVG dimensions
        .on("start", brushStarted)
        .on("brush", brushed)
        .on("end", brushEnded);

    svg.append("g")
        .attr("class", "brush")
        .call(brush);

        function writeInfo(node){
            d3.select("#clickedNodeDetails")
            .html(`<table>
                <tr>
                    <td><b>User:</b></td>
                    <td style="border-right: none;" colspan=2><span id="userID">${node.userID}</span></td>
                    <td style="border-left: none;" align=right><button class="copy-btn" onclick="copyText('userID')">🗐</button></td>
                </tr>
                <tr>
                    <td><b>Session:</b></td>
                    <td style="border-right: none;" colspan=2><span id="sessionID">${node.sessionID}</span></td>
                    <td style="border-left: none;" align=right><button class="copy-btn" onclick="copyText('sessionID')">🗐</button></td>
                </tr>
                <tr>
                    <td><b>ID:</b></td>
                    <td style="border-right: none;" colspan=2><span id="sid_rid">${node.sessionID}_${node.repetitionID}</span></td>
                    <td style="border-left: none;" align=right><button class="copy-btn" onclick="copyText('sid_rid')">🗐</button></td>
                </tr>
                <tr>
                    <td><b>Repetition:</b></td>
                    <td align=center>${node.repetitionID}</td>
                    <td><b>Total repetitions:</b></td>
                    <td align=center>${numberOfRepetitions(node.sessionID)}</td>
                </tr>
                <tr>
                    <td align><b>Hand:</b></td>
                    <td align=center>${node.hand}</td>
                    <td align><b>Dominant Hand:</b></td>
                    <td>${node.dominantHand}</td>
                </tr>
                <tr>
                    <td align><b>Degree:</b></td>
                    <td align=center>${degreeMap.get(node.id)}</td>
                    <td align><b>Avg. Degree:</b></td>
                    <td>${averageDegree}</td>
                </tr>
            </table>
        `)
    }

    // Add nodes (circles)
    const node = svg.append("g")
        .attr("stroke", "gray")
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("fill", d => centralityColorScale(degreeMap.get(d.id))) // Color scale based on totalTime
        .attr("r", d => centralityRadiusScale(degreeMap.get(d.id))) // Convert percentage to decimal & scale
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave)
        .on("click", function(event, d) {
            drawTrajectory(d, degreeMap); // Trigger the trajectory drawing function
            writeInfo(d); // Trigger the trajectory drawing function

        });
    
    function numberOfRepetitions(targetSessionID) {
        // Filter the nodes by the target sessionID
        const sessionNodes = nodes.filter(node => node.sessionID === targetSessionID);
        return sessionNodes.length;
    }  

    // Add a drag behavior to the nodes
    node.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Drag behavior functions
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.03).restart();
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

    // Customize brush styles (selection area and handles)
    svg.selectAll(".selection")  // This is the selected area
    .style("fill", "rgba(145, 184, 198, 0.75)")  // Light blue with transparency
    .style("stroke", "blue")  // Blue border for the selection area
    .style("stroke-width", 2)
    .style("stroke-dasharray", "5,5");

    svg.selectAll(".handle")  // This is the draggable handle area
    .style("fill", "blue")  // Red color for the handles
    .style("stroke", "white")  // Dark red border for the handles
    .style("stroke-width", 2);  // Handle border width
    
    function brushStarted(event) {
        if (!event.selection) return;
    }
    
    function brushed(event) {
        if (!event.selection) return;
        
        const [[x0, y0], [x1, y1]] = event.selection; // Get brush boundaries
    
        // Filter nodes within the brush area
        const selectedNodes = node.filter(d => x0 <= d.x && d.x <= x1 && y0 <= d.y && d.y <= y1);
        
        // Store selected nodes in a global variable to use in brushEnded
        window.brushedNodes = selectedNodes.data();
    }
    
    function brushEnded(event) {
        if (!event.selection) {
            node.classed("selected", false); // Reset selection if brush is cleared
            return;
        }
        d3.select(this).style("stroke", "blue");
        
        // Clear any existing trajectories before selecting new ones
        d3.select("#trajectories").selectAll("*").remove();
        drawCircle();

        // Draw trajectories for all selected nodes **after brush is done**
        if (window.brushedNodes) {
            window.brushedNodes.forEach(d => drawTrajectory(d, degreeMap));
        }
    }
     


}


function drawCircle() {
    // Clear the existing SVG content
    const svgContainer = d3.select("#trajectories");
    svgContainer.selectAll("*").remove();

    d3.json(trajectories_json).then(function(data) {
        const width = window.innerWidth / 3;
        const height = window.innerHeight / 3;

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
        const circleCenter = [0.5, 0.8]; // Center of the circle in normalized coordinates (range from 0 to 1)
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
    });
};






function drawTrajectory(node, degreeMap) {
    // Clear the existing SVG content
    const svgContainer = d3.select("#trajectories");

    d3.json(trajectories_json).then(function(data) {
        // Extract the trajectory data for the clicked node
        const nodeIndex = node.unique;
        const nodeTrajectoryData = data[nodeIndex];

        // Define margins and dimensions for the new SVG, based on viewport size
        const width = window.innerWidth / 3;
        const height = window.innerHeight / 3;


        let ratio = node.screenHeight / node.screenWidth;

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
            .x(d => x(d[0]))  // x-coordinate of trajectory points
            .y(d => y(d[1]) * 1.7); // y-coordinate of trajectory points

        // Create a color scale based on interpolation
        const scaleColor = d3.scaleSequential(d3.interpolateReds)  // You can use other color interpolations like d3.interpolateViridis or d3.interpolateInferno
            .domain([-10, 100]);  // Avoid whites

        // Get the color corresponding to the id
        let trajColor = scaleColor(degreeMap.get(node.id));

        // Create a tooltip div (hidden by default)
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(0, 0, 0, 0.75)")
            .style("color", "white")
            .style("padding", "5px")
            .style("border-radius", "4px")
            .style("font-size", "12px");


        // Append the trajectory path to the SVG
        const path = svg.append("path")
            .datum(nodeTrajectoryData)
            .attr("fill", "none")
            .attr("stroke", trajColor)  // Use the color generated from the scale
            .attr("stroke-width", 3)
            .attr("d", line)
            .attr("data-name", "Trajectory " + nodeIndex)  // Add a custom data attribute to store the name of the line

            // Add event listeners for mouse hover
            .on("mouseover", function(event) {
                d3.select(this)
                    .attr("stroke-width", 5)  // Increase the stroke width to highlight
                    .attr("stroke", "yellow");  // Change color on hover (e.g., yellow)
                // Show the tooltip with the name of the trajectory
                tooltip.style("visibility", "visible")
                    .text(d3.select(this).attr("data-name"));  // Get the name stored in the data attribute
            })
            .on("mousemove", function(event) {
                // Position the tooltip near the mouse cursor
                tooltip.style("top", (event.pageY + 5) + "px")
                    .style("left", (event.pageX + 5) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .attr("stroke-width", 3)  // Increase the stroke width to highlight
                    .attr("stroke", trajColor);  // Change color on hover (e.g., yellow)
                // Hide the tooltip when the mouse leaves the path
                tooltip.style("visibility", "hidden");
            })
            .on("click", d => {
                navigator.clipboard.writeText(nodeIndex); //clipboard API
            })
    });
}

