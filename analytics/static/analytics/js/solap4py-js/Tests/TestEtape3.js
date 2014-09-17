module("Etape 3");

QUnit.config.reorder = false;

var query = new QueryAPI();

function test31(){
  query.drill("[Traffic]");
  query.push("[Measures].[Goods Quantity]");
  query.push("[Measures].[Max Quantity]");
  query.pull('wrong measure');
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [{"[Measures].[Goods Quantity]": 43838366,"[Measures].[Max Quantity]": 407391}]);
}

function test32(){
  query.pull('[Measures].[Max Quantity]');

  var expected = {"error":"OK","data":[{"[Measures].[Goods Quantity]":4.3838366E7}]};
  var result = query.execute();
  deepEqual(result, expected, 'Tests if indeed you can take off a measure which was pushed');
}

function runTest(f){
  test(f.name, f);
}

function runTests(){
  test(test31.name, test31);
  test(test32.name, test32);
}

runTests();


