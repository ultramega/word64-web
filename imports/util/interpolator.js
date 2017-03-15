export class Interpolator {
    static accelerate(t) {
        return t * t;
    }

    static bounce(t) {
        t *= 1.1226;
        if(t < 0.3535) {
            return Interpolator._bounce(t);
        } else if(t < 0.7408) {
            return Interpolator._bounce(t - 0.54719) + 0.7;
        } else if(t < 0.9644) {
            return Interpolator._bounce(t - 0.8526) + 0.9;
        }
        return Interpolator._bounce(t - 1.0435) + 0.95;
    }

    static _bounce(t) {
        return t * t * 8.0;
    }
}
