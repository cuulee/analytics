module("Etape 4");

QUnit.config.reorder = false;

var query = new QueryAPI();

function test33(){
  query.clear();
  query.drill("[Traffic]");
  query.slice("[wrong dimension]", ["[wrong dimension].[2000]","[wrong dimension].[2010]"], false);
  var expected = "SERVER_ERROR";
  resultat = query.execute()["error"];
  deepEqual(resultat, expected, "Tests if an error is returned when the dimension doesn't exist");
}

function test34(){
  query.clear();
  query.drill("[Traffic]");
  query.push("[Measures].[Goods Quantity]");
  query.slice("[Time]", ["[Time].[-3]"], false);

  var expected = "SERVER_ERROR";
  var result = query.execute()["error"];
  equal(result, expected, "Tests if an error is returned when the member doesn't exist");
}

function test35(){
  query.clear();
  query.drill("[Traffic]");
  query.push("[Measures].[Goods Quantity]");
  query.slice("[Time]", ["[Time].[2000]","[Time].[2001]"], false);

  var expected = {"error":"OK","data":[{"[Measures].[Goods Quantity]":2487192,"[Time]":"[Time].[All Times].[2000]"},{"[Measures].[Goods Quantity]":2687089,"[Time]":"[Time].[All Times].[2001]"}]};
  var result = query.execute();
  deepEqual(result, expected, 'Test execute() on Time dimension');
}

function test36(){
  query.slice("[Zone.Name]", ["[Zone.Name].[France]","[Zone.Name].[Germany]"], false);

  var result = query.execute();
  var props = Object.keys(result);  
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  deepEqual(result["data"], [
  {
    "[Measures].[Goods Quantity]": 328711,
    "[Time]": "[Time].[All Times].[2000]",
    "[Zone]": "[Zone.Name].[All Zone.Names].[France]"
  },
  {
    "[Measures].[Goods Quantity]": 235836,
    "[Time]": "[Time].[All Times].[2000]",
    "[Zone]": "[Zone.Name].[All Zone.Names].[Germany]"
  },
  {
    "[Measures].[Goods Quantity]": 309792,
    "[Time]": "[Time].[All Times].[2001]",
    "[Zone]": "[Zone.Name].[All Zone.Names].[France]"
  },
  {
    "[Measures].[Goods Quantity]": 239232,
    "[Time]": "[Time].[All Times].[2001]",
    "[Zone]": "[Zone.Name].[All Zone.Names].[Germany]"
  }
]);

}


function test37(){
  query.project("wrong hierarchy");

  var expected = {
  "data": [
    {
      "[Measures].[Goods Quantity]": 328711,
      "[Time]": "[Time].[All Times].[2000]",
      "[Zone]": "[Zone.Name].[All Zone.Names].[France]"
    },
    {
      "[Measures].[Goods Quantity]": 235836,
      "[Time]": "[Time].[All Times].[2000]",
      "[Zone]": "[Zone.Name].[All Zone.Names].[Germany]"
    },
    {
      "[Measures].[Goods Quantity]": 309792,
      "[Time]": "[Time].[All Times].[2001]",
      "[Zone]": "[Zone.Name].[All Zone.Names].[France]"
    },
    {
      "[Measures].[Goods Quantity]": 239232,
      "[Time]": "[Time].[All Times].[2001]",
      "[Zone]": "[Zone.Name].[All Zone.Names].[Germany]"
    }
  ],
  "error": "OK"
};
  var result = query.execute();
  deepEqual(result, expected, 'Tests if when deleting a hierarchy which is not sliced, it does not delete anything');
}

function test38(){
  query.project("[Zone.Name]");

  var expected = {"error":"OK","data":[{"[Measures].[Goods Quantity]":2487192,"[Time]":"[Time].[All Times].[2000]"},{"[Measures].[Goods Quantity]":2687089,"[Time]":"[Time].[All Times].[2001]"}]};
  var result = query.execute();
  deepEqual(result, expected, 'Check if you can delete the aggregated hierarchy [Zone.Name]');
}

function runTest(f){
  test(f.name, f);
}

function runTests(){
  test(test33.name, test33);
  test(test34.name, test34);
  test(test35.name, test35);
  test(test36.name, test36);
  test(test37.name, test37);
  test(test38.name, test38);
}

runTests();
