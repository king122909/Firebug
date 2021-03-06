/**
 * This test is intended to verify various usage of console.table() method.
 */
function runTest()
{
    FBTest.sysout("console.table.START");
    FBTest.openNewTab(basePath + "console/api/table.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.enableConsolePanel(function(win)
        {
            var doc = win.document;

            // #1 table with 3 columns, 2 rows and specified text content.
            var table1 = {cols: 3, rows: 3, content: "abc123234345"};

            var text2 = "firstNamelastNameagedesc\"Susan\"\"Doyle\"32\"mother\"\"John\"\"Doyle\"33\"father\"\"Lily\"\"Doyle\"5undefined\"Mike\"\"Doyle\"8undefined";
            var table2 = {cols: 4, rows: 4, content: text2};

            var table3 = {cols: 1, rows: 3, content: "Object Properties\"propA\"\"propB\"\"propC\""};
            var table4 = table2;
            var table5 = {cols: 2, rows: 3, content: "12233445"};
            var table6 = {cols: 2, rows: 3, content: "2nd3rd233445"};

            var text7 = "firstNamelastName\"Susan\"\"Doyle\"\"John\"\"Doyle\"\"Lily\"\"Doyle\"\"Mike\"\"Doyle\"";
            var table7 = {cols: 2, rows: 4, content: text7};

            var text8 = text7;
            var table8 = {cols: 2, rows: 4, content: text8};

            var tasks = new FBTest.TaskList();
            tasks.push(executeTest, "testButton1", doc, null, [table1]);
            tasks.push(executeTest, "testButton2", doc, null, [table2]);
            tasks.push(executeTest, "testButton3", doc, null, [table3]);
            tasks.push(executeTest, "testButton4", doc, "My family", [table4]);
            tasks.push(executeTest, "testButton5", doc, null, [table5]);
            tasks.push(executeTest, "testButton6", doc, null, [table6]);
            tasks.push(executeTest, "testButton7", doc, null, [table7]);
            tasks.push(executeTest, "testButton8", doc, null, [table8]);

            tasks.run(function() {
                FBTest.testDone("console.table.DONE");
            });
        });
    });
}

/**
 * Execute specified test on the test page.
 * @param {Object} callback Called when individual test/task is finished.
 * @param {Object} doc Test page document.
 * @param {Object} title Expected title in case of expandable groups.
 * @param {Object} expected Expected layout (number of rows and cols + text content).
 */
function executeTest(callback, buttonId, doc, title, expected)
{
    var config = {tagName: "div", classes: "logRow logRow-table"};
    FBTest.waitForDisplayedElement("console", config, function(row)
    {
        if (title)
        {
            var group = FW.FBL.getAncestorByClass(row, "logRow-group");
            var titleNode = group.querySelector(".logGroupLabel");
            FBTest.ok(titleNode, "Group title must be available.");
            FBTest.compare(title, titleNode.textContent, "Group title must be: " + title);
            FBTest.mouseDown(titleNode);
        }

        verifyLogBody(row, expected);

        // Next test please.
        callback();
    });

    // Click the test button on the page.
    FBTest.click(doc.getElementById(buttonId));
}

/**
 * Verify log body (can contain more tables).
 */
function verifyLogBody(logRow, expected)
{
    var tables = logRow.querySelectorAll(".dataTable");
    FBTest.compare(expected.length, tables.length, "There must be " +
        expected.length + " table(s).");

    for (var i=0; i<expected.length; i++)
    {
        var e = expected[i];
        if (!verifyTableLayout(tables[i], e.cols, e.rows, e.content))
        {
            FBTest.testDone("console.table.FAIL");
            return;
        }
    }
}

/**
 * Helper output verificator
 * @param {Object} table The root table element.
 * @param {Object} cols Number of expected columns.
 * @param {Object} rows Number of expected rows.
 * @param {Object} textContent Expected textual content.
 */
function verifyTableLayout(table, cols, rows, textContent)
{
    FBTest.compare(textContent, table.textContent, "Verify expected text content.");

    var head = table.querySelector(".dataTableThead");
    var body = table.querySelector(".dataTableTbody");

    if (!FBTest.ok(table && body, "Table header and body must be available."))
        return false;

    FBTest.compare(1, head.childNodes.length, "The header must have one row.");
    FBTest.compare(cols, head.firstChild.childNodes.length, "There must be " + cols + " columns.");
    FBTest.compare(rows, body.childNodes.length, "There must be " + rows + " rows.");

    return true;
}
