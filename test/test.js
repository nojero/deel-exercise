let chai = require('chai');
let chaiHttp = require('chai-http');
const expect = require('chai').expect;
const chaiExclude = require('chai-exclude');

chai.use(chaiExclude);
chai.use(chaiHttp);
const url = 'http://localhost:3001';

describe('/contracts/:id ', () => {
    it('should return contract with ID 1', (done) => {
        chai.request(url)
            .get('/contracts/1')
            .set({ profile_id: 1 })
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body).excluding(['createdAt', 'updatedAt']).to.deep.equal({
                    id: 1,
                    terms: 'bla bla bla',
                    status: 'terminated',
                    ContractorId: 5,
                    ClientId: 1
                })
                done();
            });
    });
    it('should fail because of wrong user', (done) => {
        chai.request(url)
            .get('/contracts/1')
            .set({ profile_id: 6 })
            .end(function (err, res) {
                expect(res).to.have.status(404);
                done();
            });
    });
    it('should fail because of unexistant user', (done) => {
        chai.request(url)
            .get('/contracts/1')
            .set({ profile_id: 99 })
            .end(function (err, res) {
                expect(res).to.have.status(401);
                done();
            });
    });
});

describe('/contracts ', () => {
    it('should return all contracts for user with ID 1', (done) => {
        chai.request(url)
            .get('/contracts')
            .set({ profile_id: 1 })
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body).excluding(['createdAt', 'updatedAt']).to.deep.equal([
                    {
                        id: 1,
                        terms: 'bla bla bla',
                        status: 'terminated',
                        ContractorId: 5,
                        ClientId: 1
                    },
                    {
                        id: 2,
                        terms: 'bla bla bla',
                        status: 'in_progress',
                        ContractorId: 6,
                        ClientId: 1
                    }
                ]);
                done();
            });
    });
    it('should fail because of unexistant user', (done) => {
        chai.request(url)
            .get('/contracts/1')
            .set({ profile_id: 99 })
            .end(function (err, res) {
                expect(res).to.have.status(401);
                done();
            });
    });
});

describe('/jobs/unpaid ', () => {
    it('should return all unpaid jobs for user with ID 1', (done) => {
        chai.request(url)
            .get('/jobs/unpaid')
            .set({ profile_id: 1 })
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body).excludingEvery(['createdAt', 'updatedAt']).to.deep.equal([
                    {
                        id: 2,
                        description: 'work',
                        price: 201,
                        paid: null,
                        paymentDate: null,
                        ContractId: 2,
                        Contract: {
                            id: 2,
                            terms: 'bla bla bla',
                            status: 'in_progress',
                            ContractorId: 6,
                            ClientId: 1
                        }
                    }
                ]);
                done();
            });
    });
    it('should fail because of unexistant user', (done) => {
        chai.request(url)
            .get('/contracts/1')
            .set({ profile_id: 99 })
            .end(function (err, res) {
                expect(res).to.have.status(401);
                done();
            });
    });
});

describe('/jobs/:job_id/pay ', () => {
    /*
    NOTE: this modifies the DB so it only works the first time and breaks other tests
    */
    it.skip('should pay job with ID 2 - see NOTES', (done) => {
        chai.request(url)
            .post('/jobs/2/pay')
            .set({ profile_id: 1 })
            .end(function (err, res) {
                expect(res).to.have.status(200);
                done();
            });
    });
    it('should fail for wrong user', (done) => {
        chai.request(url)
            .post('/jobs/2/pay')
            .set({ profile_id: 5 })
            .end(function (err, res) {
                expect(res).to.have.status(500);
                done();
            });
    });
    it('should fail for unexistant profile', (done) => {
        chai.request(url)
            .post('/jobs/2/pay')
            .set({ profile_id: 99 })
            .end(function (err, res) {
                expect(res).to.have.status(401);
                done();
            });
    });
});

describe('/balances/deposit/:userId', () => {
    /*
    NOTE: this modifies the DB so it only works a few times
    */
    it('should deposit 1 dolar into user with ID 2', (done) => {
        chai.request(url)
            .post('/balances/deposit/2')
            .set({ profile_id: 2 })
            .query({ amount: 1 })
            .end(function (err, res) {
                expect(res).to.have.status(200);
                done();
            });
    });
    it('should fail for large amount', (done) => {
        chai.request(url)
            .post('/balances/deposit/2')
            .set({ profile_id: 2 })
            .query({ amount: 10000 })
            .end(function (err, res) {
                expect(res).to.have.status(500);
                done();
            });
    });
    it('should fail for invalid amount', (done) => {
        chai.request(url)
            .post('/balances/deposit/2')
            .set({ profile_id: 99 })
            .query({ amount: 'foo' })
            .end(function (err, res) {
                expect(res).to.have.status(500);
                done();
            });
    });
});

describe('/admin/best-profession?start=<date>&end=<date></date>', () => {
    it('should return Programmer', (done) => {
        chai.request(url)
            .get('/admin/best-profession')
            .query({ start: '2020-01-01', end: '2020-12-31' })
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body).to.equal('Programmer');
                done();
            });
    });
    it('should fail for wrong start date', (done) => {
        chai.request(url)
            .get('/admin/best-profession')
            .query({ start: 'foo', end: '2020-12-31' })
            .end(function (err, res) {
                expect(res).to.have.status(500);
                done();
            });
    });
    it('should fail for wrong end date', (done) => {
        chai.request(url)
            .get('/admin/best-profession')
            .query({ start: '2020-01-01', end: 'foo' })
            .end(function (err, res) {
                expect(res).to.have.status(500);
                done();
            });
    });
});

describe('/admin/best-clients?start=<date>&end=<date></date>&limit=<integer>', () => {
    it('should return best clients', (done) => {
        chai.request(url)
            .get('/admin/best-clients')
            .query({ start: '2020-01-01', end: '2020-12-31' })
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body).to.deep.equal([
                    { fullName: 'Ash Kethcum', id: 4, paid: 2020 },
                    { fullName: 'Mr Robot', id: 2, paid: 442 }
                ]);
                done();
            });
    });
    it('should return only first best client', (done) => {
        chai.request(url)
            .get('/admin/best-clients')
            .query({ start: '2020-01-01', end: '2020-12-31', limit: 1 })
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body).to.deep.equal([
                    { fullName: 'Ash Kethcum', id: 4, paid: 2020 }
                ]);
                done();
            });
    });
    it('should fail for wrong start date', (done) => {
        chai.request(url)
            .get('/admin/best-clients')
            .query({ start: 'foo', end: '2020-12-31' })
            .end(function (err, res) {
                expect(res).to.have.status(500);
                done();
            });
    });
    it('should fail for wrong end date', (done) => {
        chai.request(url)
            .get('/admin/best-clients')
            .query({ start: '2020-01-01', end: 'foo' })
            .end(function (err, res) {
                expect(res).to.have.status(500);
                done();
            });
    });
});
