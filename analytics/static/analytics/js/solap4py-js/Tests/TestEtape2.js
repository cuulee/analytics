module("Etape 2");

QUnit.config.reorder = false;

var query = new QueryAPI();

function test23(){
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "BAD_REQUEST", "bad request");
  equal(result["data"], "Cube not specified");
}

function test24(){
  query.drill("[wrong cube]");
  query.push("[Measures].[Goods Quantity]");
  var result = query.execute();
  var props = Object.keys(result);  
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "SERVER_ERROR", "server error");
  equal(result["data"], "Impossible to execute the query");
}

function test25(){
  query.clear();
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "BAD_REQUEST", "bad request");
  equal(result["data"], "Cube not specified");
}

function test26(){
  query.clear();
  query.drill("[Traffic]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [{"[Measures].[Goods Quantity]":43838366}]);
}

function test27(){
  query.drill("[Traffic]");
  query.push("[wrong measure]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "SERVER_ERROR", "server error");
  equal(result["data"], "Impossible to execute the query");
}

function test28(){
  query.clear();
  query.drill("[wrong cube]");
  query.push("[wrong measure]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "SERVER_ERROR", "server error");
  equal(result["data"], "Impossible to execute the query");
}

function test29(){
  query.clear();
  query.drill("[Traffic]");
  query.push("[Measures].[Goods Quantity]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [{"[Measures].[Goods Quantity]":43838366}]);
}

function test30(){
  query.push("[Measures].[Max Quantity]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [{"[Measures].[Goods Quantity]": 43838366,"[Measures].[Max Quantity]": 407391}]);
}

function runTest(f){
  test(f.name, f);
}

function runTests(){
  test(test23.name, test23);
  test(test24.name, test24);
  test(test25.name, test25);
  test(test26.name, test26);
  test(test27.name, test27);
  test(test28.name, test28);
  test(test29.name, test29);
  test(test30.name, test30);

}

runTests();


