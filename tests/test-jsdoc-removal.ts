
function testFunction(param1: string): boolean {
  return param1.length > 0;
}

// This is a regular comment that should be preserved
const regularVariable = 42;


const jsdocVariable = 100;


class TestClass {
  
  property: string;

  
  constructor(initialValue: string) {
    this.property = initialValue;
  }

  
  getProperty(): string {
    return this.property;
  }
}

// Export for testing
export { jsdocVariable, regularVariable, TestClass, testFunction };
