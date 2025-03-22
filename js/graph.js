let similarityMatrix = [];
let nodes = [];
let links = [];
let headerData = [];
let centralityValues = [];
let isScalingEnabled = false;  // Default to scaling being enabled
let isInverseScaling = true; // Default scaling direction (direct scaling)
let scalingFactor = 1;  // Default scaling factor
let prioritizeHigherCentrality = false; // Flag for color scheme toggle

// Load both similarity matrix and header data
Promise.all([
    d3.json("json/adjacency_1_100.json"),  // Similarity matrix
    d3.json("json/headerdata_1_100.json")  // Node information from header data
]).then(function([similarityData, headerDataJson]) {
    similarityMatrix = similarityData;
    headerData = headerDataJson;
    updateGraph();  // Initialize graph data and update
});

// Function to update the graph based on threshold
function updateGraph() {
    const threshold = parseFloat(document.getElementById('threshold').value);

    // Prepare the nodes by combining node IDs with additional information from headerData
    nodes = similarityMatrix.map((_, index) => ({
        id: index,
        ...headerData[index] // Merge corresponding node info from JSON
    }));

    // Prepare the links (only include those under the threshold)
    links = [];
    for (let i = 0; i < similarityMatrix.length; i++) {
        for (let j = i + 1; j < similarityMatrix.length; j++) {
            if (similarityMatrix[i][j] <= threshold) {
                links.push({ source: i, target: j, value: similarityMatrix[i][j] });
            }
        }
    }

    // Compute degree centrality (node degree)
    centralityValues = nodes.map(node => {
        const degree = links.filter(link => link.source === node.id || link.target === node.id).length;
        return { id: node.id, degree };
    });

    // Specify the dimensions of the chart
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Define the color scale (this will change based on the toggle)
    const color = prioritizeHigherCentrality
        ? d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(centralityValues, d => d.degree)]) // Higher centrality darker
        : d3.scaleSequential(d3.interpolateBlues).domain([d3.max(centralityValues, d => d.degree), 0]); // Lower centrality lighter

    // Create the SVG container
    const svg = d3.select("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width / 2, -height / 2, width, height]);

    // Clear the previous graph (links and nodes) before updating
    svg.selectAll("*").remove();

    // Add links (edges)
    const link = svg.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => Math.sqrt(d.value));

    // Add nodes (vertices)
    const node = svg.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", d => {
            if (isScalingEnabled) {
                // Apply the scaling factor selected by the user
                const centralityValue = centralityValues.find(c => c.id === d.id).degree;
                
                // Apply scaling logic based on direct or inverse scaling
                if (isInverseScaling) {
                    return (10 / (1 + centralityValue)) * scalingFactor;
                } else {
                    return (centralityValue + 1) * scalingFactor;  // Direct scaling
                }
            }
            return 5;  // Default size when scaling is disabled
        })
        .attr("fill", d => {
            // Map node centrality to color using the selected color scale
            const centralityValue = centralityValues.find(c => c.id === d.id).degree;
            return color(centralityValue);  // Use the color scale based on centrality
        })
        .on("mouseover", function(event, d) {
            // Show tooltip with node details
            d3.select("#tooltip")
                .style("opacity", 1)
                .html(`
                    <b>Session ID:</b> ${d.sessionID}<br>
                    <b>Repetition ID:</b> ${d.repetitionID}<br>
                    <b>User ID:</b> ${d.userID}<br>
                    <b>Hand:</b> ${d.hand}<br>
                    <b>Game Code:</b> ${d.gameCode}<br>
                    <b>Accuracy:</b> ${d.accuracy.toFixed(2)}<br>
                    <b>Distance Tot:</b> ${d.distanceTot}<br>
                    <b>Time:</b> ${d.time.toFixed(2)}<br>
                    <b>Deviation Index:</b> ${d.deviationIndex.toFixed(5)}<br>
                    <b>Status:</b> ${d.status}`);
            
            // Highlight links associated with the hovered node
            link
                .style("stroke", function(l) {
                    if (l.source.id === d.id || l.target.id === d.id) {
                        return "red";  // Highlight link
                    }
                    return "#999";  // Default color
                })
                .style("stroke-opacity", function(l) {
                    if (l.source.id === d.id || l.target.id === d.id) {
                        return 1;  // Full opacity for highlighted links
                    }
                    return 0.6;  // Default opacity
                });
            
            // Position the tooltip near the cursor with an offset
            const tooltipWidth = document.getElementById("tooltip").offsetWidth;
            const tooltipHeight = document.getElementById("tooltip").offsetHeight;

            d3.select("#tooltip")
                .style("left", (event.pageX + 10) + "px")  // Positioning X with some offset
                .style("top", (event.pageY + 10) + "px");  // Positioning Y with some offset
        })
        .on("mouseout", function() {
            // Hide tooltip
            d3.select("#tooltip").style("opacity", 0);

            // Reset the link styles
            link
                .style("stroke", "#999")
                .style("stroke-opacity", 0.6);
        });

    node.append("title")
        .text(d => `Node ${d.id}`);

    // Add drag behavior to nodes
    node.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Create the force simulation with the updated links and nodes
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id))
        .force("charge", d3.forceManyBody())
        .force("x", d3.forceX())
        .force("y", d3.forceY());

    // Update positions during simulation
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    });

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
}

// Event listener for threshold input
document.getElementById('threshold').addEventListener('input', updateGraph);

// Function to toggle node scaling
function toggleNodeScaling() {
    isScalingEnabled = document.getElementById('scalingCheckbox').checked;
    document.getElementById('scalingFactor').disabled = !isScalingEnabled;  // Enable/disable the slider based on checkbox
    if (!isScalingEnabled) {
        document.getElementById('scalingFactor').value = 1;  // Reset scaling factor if scaling is disabled
        document.getElementById('scalingFactorValue').innerText = '1';  // Update slider value display
    }
    updateGraph();  // Re-update the graph with the new scaling setting
}

// Function to update scaling factor display
document.getElementById('scalingFactor').addEventListener('input', function() {
    scalingFactor = parseFloat(this.value);
    document.getElementById('scalingFactorValue').innerText = scalingFactor;
    updateGraph();  // Re-update the graph with the new scaling factor
});

// Function to toggle scaling direction
function toggleScalingDirection() {
    isInverseScaling = document.getElementById('inverseScalingCheckbox').checked;
    updateGraph();  // Re-update the graph when switching scaling direction
}

// Function to toggle prioritizing higher centrality for color scale
function toggleColorPriority() {
    prioritizeHigherCentrality = document.getElementById('colorPriorityCheckbox').checked;
    updateGraph();  // Re-update the graph when switching color priority
}
